"use server";

import { refresh } from "next/cache";
import { daysBetween, toLocal, zonedTimeToInstant } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { deriveValues, parseResultForm, resultTypes } from "@/lib/results/input";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";

export type ResultState = {
  errors?: Record<string, string>;
  failed?: boolean;
  savedAt?: number;
  /** What was typed, returned with errors so the form keeps it. */
  values?: Record<string, string>;
};

function typed(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") values[k] = v;
  return values;
}

/**
 * Saves a lab result with the ranges printed on the owner's report, the
 * pack's derived values, and where it falls in the injection cycle.
 */
export async function logResult(_state: ResultState, form: FormData): Promise<ResultState> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const conditionId = String(form.get("dog_condition_id") ?? "");
  const { data: condition, error: conditionError } = await supabase
    .from("dog_conditions")
    .select("id, condition_key")
    .eq("id", conditionId)
    .maybeSingle<{ id: string; condition_key: string }>();
  if (conditionError || !condition) {
    console.error("[results] condition lookup failed", { code: conditionError?.code });
    return { failed: true, values: typed(form) };
  }

  const pack = getPack(condition.condition_key);
  const type = resultTypes(pack).find((t) => t.key === form.get("type_key"));
  if (!type) return { failed: true, values: typed(form) };

  const timeZone = await getTimeZone(owner.userId);
  const now = new Date();
  const today = toLocal(now, timeZone).date;
  const parsed = parseResultForm(form, type, today);
  if (!parsed.ok) return { errors: parsed.errors, values: typed(form) };
  const r = parsed.value;

  // The cycle the blood was taken in: the latest injection on or before that day.
  const { data: anchor } = await supabase
    .from("anchors")
    .select("anchored_on, cycle_no")
    .eq("dog_condition_id", condition.id)
    .lte("anchored_on", r.taken_on)
    .order("anchored_on", { ascending: false })
    .limit(1)
    .maybeSingle<{ anchored_on: string; cycle_no: number }>();

  const derived = Object.fromEntries(deriveValues(pack, type.key, r.values).map((d) => [d.key, d.value]));
  const { error } = await supabase.from("observations").insert({
    dog_condition_id: condition.id,
    type_key: type.key,
    taken_at: (r.taken_on === today ? now : zonedTimeToInstant(r.taken_on, "12:00", timeZone)).toISOString(),
    values_json: r.values,
    ranges_json: Object.keys(r.ranges).length > 0 ? r.ranges : null,
    derived_json: Object.keys(derived).length > 0 ? derived : null,
    cycle_no: anchor?.cycle_no ?? null,
    days_since_anchor: anchor ? daysBetween(anchor.anchored_on, r.taken_on) : null,
    note: r.note,
  });
  if (error) {
    console.error("[results] save failed", { code: error.code, message: error.message });
    return { failed: true, values: typed(form) };
  }
  refresh();
  return { savedAt: Date.now() };
}

/** Removes a result. The form offers it only to the person who recorded it. */
export async function removeResult(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("observations")
    .delete()
    .eq("id", String(form.get("observation_id") ?? ""))
    .eq("recorded_by", owner.userId);
  if (error) console.error("[results] remove failed", { code: error.code, message: error.message });
  refresh();
}
