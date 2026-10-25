import "server-only";
import type { LocalDate } from "@/engine/time";
import { dogHasPlus } from "@/lib/history/queries";
import { historyStart } from "@/lib/history/window";
import { createClient } from "@/lib/supabase/server";
import { type NoticedRow, noticedVisible } from "./view";

const COLUMNS =
  "id, dog_id, rule_family, computed_on, window_start, window_end, copy, evidence_json, shown_at, opened_at, dismissed_at, added_to_report_at, added_by";

/** Most kept on one screen; at one a week that is two years. */
const LIMIT = 104;

/** The dog's observations, latest first, read under row-level security. */
export async function getNoticed(dogId: string, opts: { dismissed?: boolean } = {}): Promise<NoticedRow[]> {
  const supabase = await createClient();
  let q = supabase.from("observations_noticed").select(COLUMNS).eq("dog_id", dogId);
  if (!opts.dismissed) q = q.is("dismissed_at", null);
  const { data, error } = await q.order("computed_on", { ascending: false }).order("id").limit(LIMIT);
  if (error) throw new Error(`Could not load what Tailhelm noticed: ${error.message}`);
  return (data ?? []) as NoticedRow[];
}

/** One observation, or null when it isn't the household's. */
export async function getNoticedOne(id: string): Promise<NoticedRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("observations_noticed").select(COLUMNS).eq("id", id).maybeSingle<NoticedRow>();
  if (error && error.code !== "22P02") throw new Error(`Could not load what Tailhelm noticed: ${error.message}`);
  return data ?? null;
}

/** Whether Noticed is switched on for the dog, for everyone in the household. */
export async function noticedOn(dogId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dogs").select("noticed_off").eq("id", dogId).maybeSingle<{ noticed_off: boolean }>();
  if (error) throw new Error(`Could not load the Noticed setting: ${error.message}`);
  return data ? !data.noticed_off : false;
}

export type NoticedState = { on: boolean; plus: boolean; rows: NoticedRow[] };

/**
 * What a screen shows of Noticed: whether it is on, and the observations the
 * household's plan can see, latest first. Null when it cannot be read, so the
 * rest of the screen still shows; the failure is logged.
 */
export async function loadNoticed(dogId: string, today: LocalDate): Promise<NoticedState | null> {
  try {
    const [on, plus] = await Promise.all([noticedOn(dogId), dogHasPlus(dogId)]);
    if (!on) return { on, plus, rows: [] };
    const from = historyStart(today, plus);
    return { on, plus, rows: (await getNoticed(dogId)).filter((r) => noticedVisible(r, from)) };
  } catch (error) {
    console.error("[noticed] could not load", { message: (error as Error).message });
    return null;
  }
}
