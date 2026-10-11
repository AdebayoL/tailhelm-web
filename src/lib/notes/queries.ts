import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NOTE_KIND } from "./input";

/** created_at is when it was typed in; empty for notes saved before this was kept. */
export type Note = { id: string; started_at: string; note: string; recorded_by: string | null; created_at: string | null };

/** The dog's notes, latest first. Row-level security limits them to the household. */
export async function getNotes(dogId: string, limit = 50): Promise<Note[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, started_at, note, recorded_by, created_at")
    .eq("dog_id", dogId)
    .eq("kind", NOTE_KIND)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load notes: ${error.message}`);
  return (data ?? []) as Note[];
}
