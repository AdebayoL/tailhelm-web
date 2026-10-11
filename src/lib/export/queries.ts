import "server-only";
import { createClient } from "@/lib/supabase/server";
import { householdNames } from "@/lib/today/queries";
import { CONDITION_NAMES } from "@/packs/pack-sql";
import type { ExportData } from "./csv";

/**
 * Everything held about the signed-in person's dogs, read under row-level
 * security, so it holds only the dogs in their household.
 */
export async function getExportData(): Promise<ExportData> {
  const supabase = await createClient();
  const all = async <T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string) => {
    const { data, error } = await query;
    if (error) throw new Error(`Could not export ${what}: ${error.message}`);
    return (data ?? []) as T[];
  };

  const dogs = await all<ExportData["dogs"][number]>(
    supabase
      .from("dogs")
      .select("id, name, breed, sex, date_of_birth, vet_name, vet_phone, vet_email, out_of_hours_phone, insurance_ref, status")
      .order("created_at"),
    "dogs",
  );
  const dogIds = dogs.map((d) => d.id);
  if (dogIds.length === 0) {
    return { dogs, conditions: [], planItems: [], treatments: [], vials: [], observations: [], events: [], names: {} };
  }

  const [conditionRows, events, nameMaps] = await Promise.all([
    all<Omit<ExportData["conditions"][number], "name">>(
      supabase.from("dog_conditions").select("id, dog_id, condition_key, pack_version, variant, diagnosed_on").in("dog_id", dogIds),
      "conditions",
    ),
    all<ExportData["events"][number]>(
      supabase.from("events").select("dog_id, kind, started_at, ended_at, note, recorded_by").in("dog_id", dogIds).order("started_at"),
      "events",
    ),
    Promise.all(dogIds.map(householdNames)),
  ]);
  const conditions = conditionRows.map((c) => ({ ...c, name: CONDITION_NAMES[c.condition_key] ?? c.condition_key }));
  const conditionIds = conditions.map((c) => c.id);

  const [planItems, observations] = await Promise.all([
    all<ExportData["planItems"][number]>(
      supabase
        .from("plan_items")
        .select("id, dog_condition_id, product, strength, dose_amount, dose_unit, schedule_json, set_by_vet_on, vet_instructions, active, created_at, created_by")
        .in("dog_condition_id", conditionIds)
        .order("created_at"),
      "the plan",
    ),
    all<ExportData["observations"][number]>(
      supabase
        .from("observations")
        .select("dog_condition_id, type_key, taken_at, values_json, ranges_json, derived_json, cycle_no, days_since_anchor, note, recorded_by")
        .in("dog_condition_id", conditionIds)
        .order("taken_at"),
      "observations",
    ),
  ]);
  const itemIds = planItems.map((i) => i.id);

  const [treatments, vials] = await Promise.all([
    all<ExportData["treatments"][number]>(
      supabase
        .from("treatments")
        .select("plan_item_id, given_at, given_on, slot, extra_no, amount, unit, given_by_profile, given_by, site, vial_id, note")
        .in("plan_item_id", itemIds)
        .order("given_at"),
      "doses given",
    ),
    all<ExportData["vials"][number]>(
      supabase.from("vials").select("id, plan_item_id, batch, expires_on, opened_on").in("plan_item_id", itemIds),
      "vials",
    ),
  ]);

  return { dogs, conditions, planItems, treatments, vials, observations, events, names: Object.assign({}, ...nameMaps) };
}
