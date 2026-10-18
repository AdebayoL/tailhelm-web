import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FINISH_LATER_HOURS, HAPPENING_KIND } from "./timer";

export type Capture = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  note: string | null;
  detail_complete: boolean;
  recorded_by: string | null;
};

const COLUMNS = "id, started_at, ended_at, duration_s, note, detail_complete, recorded_by";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The dog's Happening now captures that Today shows: the one running, if any,
 * and those stopped in the last 48 hours still waiting for their detail.
 * Read under row-level security, so only the household's.
 */
export async function getCaptures(dogId: string, now: Date): Promise<{ running: Capture | null; unfinished: Capture[] }> {
  const supabase = await createClient();
  const since = new Date(now.getTime() - FINISH_LATER_HOURS * 3600000).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("dog_id", dogId)
    .eq("capture_mode", "happening_now")
    .eq("detail_complete", false)
    .or(`ended_at.is.null,ended_at.gte.${since}`)
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(`Could not load Happening now: ${error.message}`);
  const rows = (data ?? []) as Capture[];
  return { running: rows.find((r) => r.ended_at === null) ?? null, unfinished: rows.filter((r) => r.ended_at !== null) };
}

/** One capture, for adding its detail. */
export async function getCapture(id: string): Promise<(Capture & { dog_id: string }) | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(`${COLUMNS}, dog_id`)
    .eq("id", id)
    .eq("kind", HAPPENING_KIND)
    .maybeSingle();
  if (error) throw new Error(`Could not load the capture: ${error.message}`);
  return (data as (Capture & { dog_id: string }) | null) ?? null;
}
