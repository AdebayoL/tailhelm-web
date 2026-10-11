import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Scale } from "@/lib/weight/input";
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
  /** Weights only: the clinic's scale or a home one. Empty for weights saved before it was asked. */
  scale: Scale | null;
  /** When it was typed in. Empty for records saved before this was kept. */
  created_at: string | null;
};

/**
 * The condition's observations of the given types, latest first, such as lab
 * results or weights. Row-level security limits them to the household.
 */
export async function getResults(conditionId: string, typeKeys: string[], limit = 50): Promise<Result[]> {
  if (typeKeys.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("observations")
    .select("id, type_key, taken_at, values_json, ranges_json, derived_json, cycle_no, days_since_anchor, note, recorded_by, scale, created_at")
    .eq("dog_condition_id", conditionId)
    .in("type_key", typeKeys)
    .order("taken_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load results: ${error.message}`);
  return (data ?? []) as Result[];
}
