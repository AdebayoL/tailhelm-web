import "server-only";
import { cache } from "react";
import { type LocalDate, zonedTimeToInstant } from "@/engine/time";
import { createClient } from "@/lib/supabase/server";

/** Whether anyone in the dog's household has Tailhelm Plus. Everyone is on free until payments exist. */
export const dogHasPlus = cache(async (dogId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dog_has_plus", { dog: dogId });
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  return data === true;
});

/**
 * Whether the household recorded anything about the dog before the given day:
 * a dose, check, result, weight, note or event. Only then does a free
 * account's history screen say that older records are kept.
 */
export async function hasRecordsBefore(
  dogId: string,
  conditionId: string | null,
  from: LocalDate,
  timeZone: string,
): Promise<boolean> {
  const supabase = await createClient();
  const before = zonedTimeToInstant(from, "00:00", timeZone).toISOString();
  const none = Promise.resolve({ data: [], error: null });
  const [doses, observations, events] = await Promise.all([
    conditionId
      ? supabase.from("treatments").select("id, plan_items!inner(dog_condition_id)").eq("plan_items.dog_condition_id", conditionId).lt("given_on", from).limit(1)
      : none,
    conditionId ? supabase.from("observations").select("id").eq("dog_condition_id", conditionId).lt("taken_at", before).limit(1) : none,
    supabase.from("events").select("id").eq("dog_id", dogId).lt("started_at", before).limit(1),
  ]);
  const failed = doses.error ?? observations.error ?? events.error;
  if (failed) throw new Error(`Could not check for older records: ${failed.message}`);
  return [doses, observations, events].some((r) => (r.data ?? []).length > 0);
}
