import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Range } from "./input";

export type Result = {
  id: string;
  type_key: string;
  taken_at: string;
  values_json: Record<string, number>;
  ranges_json: Record<string, Range> | null;
  derived_json: Record<string, number> | null;
  cycle_no: number | null;
  days_since_anchor: number | null;
  note: string | null;
  recorded_by: string | null;
};

/** The condition's lab results, latest first. Row-level security limits them to the household. */
export async function getResults(conditionId: string, limit = 50): Promise<Result[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("observations")
    .select("id, type_key, taken_at, values_json, ranges_json, derived_json, cycle_no, days_since_anchor, note, recorded_by")
    .eq("dog_condition_id", conditionId)
    .order("taken_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load results: ${error.message}`);
  return (data ?? []) as Result[];
}
