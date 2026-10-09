import "server-only";
import type { PlanSchedule } from "@/engine/schedule";
import { createClient } from "@/lib/supabase/server";

export type DogCondition = {
  id: string;
  condition_key: string;
  pack_version: string;
  variant: string | null;
  diagnosed_on: string | null;
};

export type PlanItem = {
  id: string;
  pack_key: string;
  product: string | null;
  strength: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_json: PlanSchedule;
  set_by_vet_on: string | null;
  vet_instructions: string | null;
};

export type DogPlan = { condition: DogCondition; items: PlanItem[] };

/** The dog's condition and the plan items in use now. Row-level security limits both to the household. */
export async function getDogPlan(dogId: string): Promise<DogPlan | null> {
  const supabase = await createClient();
  const { data: condition, error } = await supabase
    .from("dog_conditions")
    .select("id, condition_key, pack_version, variant, diagnosed_on")
    .eq("dog_id", dogId)
    .order("condition_key")
    .limit(1)
    .maybeSingle<DogCondition>();
  if (error) throw new Error(`Could not load the condition: ${error.message}`);
  if (!condition) return null;

  const { data, error: itemsError } = await supabase
    .from("plan_items")
    .select("id, pack_key, product, strength, dose_amount, dose_unit, schedule_json, set_by_vet_on, vet_instructions")
    .eq("dog_condition_id", condition.id)
    .eq("active", true)
    .order("created_at");
  if (itemsError) throw new Error(`Could not load the plan: ${itemsError.message}`);
  const items = data as PlanItem[] | null;

  // Postgres numerics arrive as numbers or strings depending on the driver; keep them as typed numbers.
  return {
    condition,
    items: (items ?? []).map((i) => ({ ...i, dose_amount: i.dose_amount === null ? null : Number(i.dose_amount) })),
  };
}
