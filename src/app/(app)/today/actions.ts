"use server";

import { refresh } from "next/cache";
import { parsePlanSchedule } from "@/engine/schedule";
import { toLocal, zonedTimeToInstant } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { parseSignsForm, signsType } from "@/lib/signs/signs";
import { parseInjectionForm } from "@/lib/treatments/input";
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
  const owner = await requireOwner();
  const supabase = await createClient();
  const planItemId = String(form.get("plan_item_id") ?? "");
  const slot = String(form.get("slot") ?? "");
  const second = form.get("second_dose") === "confirmed";

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
  const givenOn = toLocal(new Date(), timeZone).date;

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

export type CheckState = { failed?: boolean; savedAt?: number };

/**
 * Saves a quick check: the signs ticked, or none. Each check is its own
 * record with who saved it and when, so two people checking the dog on the
 * same day both show.
 */
export async function logQuickCheck(
  _state: CheckState,
  form: FormData,
): Promise<CheckState> {
  await requireOwner();
  const supabase = await createClient();
  const conditionId = String(form.get("dog_condition_id") ?? "");
  const { data: condition, error: conditionError } = await supabase
    .from("dog_conditions")
    .select("id, condition_key")
    .eq("id", conditionId)
    .maybeSingle<{ id: string; condition_key: string }>();
  const type = condition && signsType(getPack(condition.condition_key));
  if (conditionError || !condition || !type) {
    console.error("[today] quick check refused", { code: conditionError?.code });
    return { failed: true };
  }
  const signs = parseSignsForm(form, type);
  const { error } = await supabase.from("observations").insert({
    dog_condition_id: condition.id,
    type_key: type.key,
    taken_at: new Date().toISOString(),
    values_json: Object.fromEntries(signs.map((s) => [s, true])),
  });
  if (error) {
    console.error("[today] quick check failed", {
      code: error.code,
      message: error.message,
    });
    return { failed: true };
  }
  refresh();
  return { savedAt: Date.now() };
}

/** Removes a quick check the signed-in person saved. */
export async function undoQuickCheck(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("observations")
    .delete()
    .eq("id", String(form.get("observation_id") ?? ""))
    .eq("recorded_by", owner.userId);
  if (error)
    console.error("[today] undo quick check failed", {
      code: error.code,
      message: error.message,
    });
  refresh();
}
