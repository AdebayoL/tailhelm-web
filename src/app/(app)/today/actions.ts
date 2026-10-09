"use server";

import { refresh } from "next/cache";
import { parsePlanSchedule } from "@/engine/schedule";
import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone, householdNames } from "@/lib/today/queries";

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
