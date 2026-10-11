"use server";

import { refresh } from "next/cache";
import { parsePlanSchedule } from "@/engine/schedule";
import { toLocal, zonedTimeToInstant } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  STRESS_EVENT_KIND,
  getTimeZone,
  householdNames,
} from "@/lib/today/queries";
import { parseStressEventForm } from "@/lib/events/input";
import { signsType } from "@/lib/signs/signs";
import { parseInjectionForm } from "@/lib/treatments/input";
import { queuedTickTime } from "@/lib/offline/ticks";
import { getPack } from "@/packs/registry";

export type TickState = {
  done?: boolean;
  failed?: boolean;
  /** Someone else ticked this dose first: who, and at what time on the owner's clock. */
  alreadyGiven?: { by: string; at: string };
};

const UNIQUE_VIOLATION = "23505";

/**
 * Records a dose as given now. The tick is a lock: the database accepts one
 * tick per dose per day, so when two people tick, the second is told who got
 * there first instead of two doses being recorded. A second dose is recorded
 * only when the owner has confirmed it.
 */
export async function tickDose(
  _state: TickState,
  form: FormData,
): Promise<TickState> {
  return recordTick({
    planItemId: String(form.get("plan_item_id") ?? ""),
    slot: String(form.get("slot") ?? ""),
    second: form.get("second_dose") === "confirmed",
    givenAt: new Date(),
  });
}

/**
 * Sends a tick made with no signal, at the time it was made on the phone. It
 * goes through the same lock, so if someone else ticked the dose meanwhile the
 * owner is told who and when, and nothing is recorded twice.
 */
export async function sendQueuedTick(entry: {
  planItemId: string;
  slot: string;
  givenAt: string;
}): Promise<TickState> {
  const givenAt = queuedTickTime(entry.givenAt, new Date());
  if (!givenAt) return { failed: true };
  return recordTick({ planItemId: String(entry.planItemId), slot: String(entry.slot), second: false, givenAt });
}

async function recordTick({
  planItemId,
  slot,
  second,
  givenAt,
}: {
  planItemId: string;
  slot: string;
  second: boolean;
  givenAt: Date;
}): Promise<TickState> {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("plan_items")
    .select("id, schedule_kind, schedule_json, active, dog_conditions(dog_id)")
    .eq("id", planItemId)
    .maybeSingle<{
      id: string;
      schedule_kind: "fixed";
      schedule_json: unknown;
      active: boolean;
      dog_conditions: { dog_id: string };
    }>();
  const schedule =
    item && parsePlanSchedule(item.schedule_json, item.schedule_kind);
  if (
    itemError ||
    !item?.active ||
    !schedule?.ok ||
    schedule.schedule.kind !== "fixed" ||
    !schedule.schedule.times.includes(slot)
  ) {
    console.error("[today] tick refused", {
      code: itemError?.code,
      planItemId,
    });
    return { failed: true };
  }

  const timeZone = await getTimeZone(owner.userId);
  const givenOn = toLocal(givenAt, timeZone).date;

  let extraNo = 0;
  if (second) {
    const { data: existing } = await supabase
      .from("treatments")
      .select("extra_no")
      .eq("plan_item_id", item.id)
      .eq("given_on", givenOn)
      .eq("slot", slot)
      .order("extra_no", { ascending: false })
      .limit(1)
      .maybeSingle<{ extra_no: number }>();
    if (!existing) return { failed: true };
    extraNo = existing.extra_no + 1;
  }

  const { error } = await supabase.from("treatments").insert({
    plan_item_id: item.id,
    given_at: givenAt.toISOString(),
    given_on: givenOn,
    slot,
    extra_no: extraNo,
    extra_confirmed: extraNo > 0,
  });

  if (error?.code === UNIQUE_VIOLATION) {
    const { data: first } = await supabase
      .from("treatments")
      .select("given_at, given_by_profile")
      .eq("plan_item_id", item.id)
      .eq("given_on", givenOn)
      .eq("slot", slot)
      .eq("extra_no", extraNo)
      .maybeSingle<{ given_at: string; given_by_profile: string | null }>();
    const names = await householdNames(item.dog_conditions.dog_id);
    refresh();
    return {
      alreadyGiven: {
        by:
          first?.given_by_profile === owner.userId
            ? "you"
            : ((first?.given_by_profile && names[first.given_by_profile]) ??
              "someone in the household"),
        at: first ? toLocal(new Date(first.given_at), timeZone).time : slot,
      },
    };
  }
  if (error) {
    console.error("[today] tick failed", {
      code: error.code,
      message: error.message,
    });
    return { failed: true };
  }
  refresh();
  return { done: true };
}

/** Removes a tick. Row-level security lets people undo only their own. */
export async function undoTick(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("treatments")
    .delete()
    .eq("id", String(form.get("treatment_id") ?? ""));
  if (error)
    console.error("[today] undo failed", {
      code: error.code,
      message: error.message,
    });
  refresh();
}

export type InjectionState = {
  errors?: Record<string, string>;
  failed?: boolean;
  savedAt?: number;
  values?: Record<string, string>;
};

/**
 * Logs an injection on a cycle and starts the next cycle from its date, in one
 * step in the database. Refused if one is already logged on or after that date,
 * so the same injection is never recorded twice.
 */
export async function logInjection(
  _state: InjectionState,
  form: FormData,
): Promise<InjectionState> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const itemId = String(form.get("plan_item_id") ?? "");
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;

  const { data: last } = await supabase
    .from("treatments")
    .select("given_on")
    .eq("plan_item_id", itemId)
    .eq("slot", "injection")
    .order("given_on", { ascending: false })
    .limit(1)
    .maybeSingle<{ given_on: string }>();

  const timeZone = await getTimeZone(owner.userId);
  const now = new Date();
  const today = toLocal(now, timeZone).date;
  const parsed = parseInjectionForm(form, {
    today,
    lastGivenOn: last?.given_on ?? null,
  });
  if (!parsed.ok) return { errors: parsed.errors, values };
  const v = parsed.value;

  // Today's injection is stamped now; an earlier one has no known time, so midday on its date.
  const at =
    v.given_on === today
      ? now
      : zonedTimeToInstant(v.given_on, "12:00", timeZone);
  const { error } = await supabase.rpc("log_cycle_treatment", {
    item: itemId,
    on_date: v.given_on,
    at: at.toISOString(),
    amount: v.amount,
    unit: v.unit,
    given_by: v.given_by,
    site: v.site,
    note: v.note,
    vial: v.vial && "id" in v.vial ? v.vial.id : null,
    new_vial: v.vial && "new" in v.vial ? v.vial.new : null,
  });
  if (error) {
    console.error("[today] log injection failed", {
      code: error.code,
      message: error.message,
    });
    if (error.code === "23514" || error.code === UNIQUE_VIOLATION) {
      return {
        errors: {
          given_on: "An injection is already logged on or after that date.",
        },
        values,
      };
    }
    return { failed: true, values };
  }
  refresh();
  return { savedAt: Date.now() };
}

export type CheckState = { failed?: boolean };

/** The dog's condition and its checklist, checked against the pack. */
async function checkCondition(conditionId: string) {
  const supabase = await createClient();
  const { data: condition, error } = await supabase
    .from("dog_conditions")
    .select("id, condition_key")
    .eq("id", conditionId)
    .maybeSingle<{ id: string; condition_key: string }>();
  const type = condition && signsType(getPack(condition.condition_key));
  if (error || !condition || !type) {
    console.error("[today] check refused", { code: error?.code });
    return null;
  }
  return { supabase, condition, type };
}

/**
 * Ticks one sign on today's check. Each tick is its own record with who made
 * it and when, so two people checking the dog on the same day both show.
 */
export async function tickSign(form: FormData): Promise<CheckState> {
  await requireOwner();
  const found = await checkCondition(String(form.get("dog_condition_id") ?? ""));
  const sign = String(form.get("sign") ?? "");
  if (!found || !found.type.signs.some((s) => s.key === sign)) return { failed: true };
  const { error } = await found.supabase.from("observations").insert({
    dog_condition_id: found.condition.id,
    type_key: found.type.key,
    taken_at: new Date().toISOString(),
    values_json: { [sign]: true },
  });
  if (error) {
    console.error("[today] tick sign failed", { code: error.code, message: error.message });
    return { failed: true };
  }
  refresh();
  return {};
}

/** Unticks a sign the signed-in person ticked today. Anyone else's tick stays. */
export async function untickSign(form: FormData): Promise<CheckState> {
  const owner = await requireOwner();
  const found = await checkCondition(String(form.get("dog_condition_id") ?? ""));
  const sign = String(form.get("sign") ?? "");
  if (!found) return { failed: true };
  const timeZone = await getTimeZone(owner.userId);
  const now = new Date();
  const dayStart = zonedTimeToInstant(toLocal(now, timeZone).date, "00:00", timeZone);
  const { data, error } = await found.supabase
    .from("observations")
    .select("id, values_json")
    .eq("dog_condition_id", found.condition.id)
    .eq("type_key", found.type.key)
    .eq("recorded_by", owner.userId)
    .gte("taken_at", dayStart.toISOString());
  if (error) {
    console.error("[today] untick sign failed", { code: error.code, message: error.message });
    return { failed: true };
  }
  for (const row of (data ?? []) as { id: string; values_json: Record<string, boolean> }[]) {
    if (!row.values_json[sign]) continue;
    const rest = Object.fromEntries(Object.entries(row.values_json).filter(([k]) => k !== sign));
    const done =
      Object.keys(rest).length === 0
        ? await found.supabase.from("observations").delete().eq("id", row.id)
        : await found.supabase.from("observations").update({ values_json: rest }).eq("id", row.id);
    if (done.error) {
      console.error("[today] untick sign failed", { code: done.error.code, message: done.error.message });
      return { failed: true };
    }
  }
  refresh();
  return {};
}

export type EventState = {
  errors?: Record<string, string>;
  failed?: boolean;
  savedAt?: number;
  values?: Record<string, string>;
};

/** Plans a stressful event, such as kennels, so Today can show the vet's plan ahead of it. */
export async function addStressEvent(
  _state: EventState,
  form: FormData,
): Promise<EventState> {
  const owner = await requireOwner();
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
  const parsed = parseStressEventForm(form);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const timeZone = await getTimeZone(owner.userId);
  const noon = (d: string) => zonedTimeToInstant(d, "12:00", timeZone).toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    dog_id: String(form.get("dog_id") ?? ""),
    kind: STRESS_EVENT_KIND,
    started_at: noon(parsed.value.starts_on),
    ended_at: parsed.value.ends_on ? noon(parsed.value.ends_on) : null,
    note: parsed.value.title,
    capture_mode: "logged",
  });
  if (error) {
    console.error("[today] add event failed", {
      code: error.code,
      message: error.message,
    });
    return { failed: true, values };
  }
  refresh();
  return { savedAt: Date.now() };
}

/** Removes a planned event the signed-in person added. */
export async function removeStressEvent(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", String(form.get("event_id") ?? ""))
    .eq("recorded_by", owner.userId);
  if (error)
    console.error("[today] remove event failed", {
      code: error.code,
      message: error.message,
    });
  refresh();
}
