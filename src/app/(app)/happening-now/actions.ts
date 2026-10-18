"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { HAPPENING_KIND } from "@/lib/happening/timer";
import { queuedTickTime } from "@/lib/offline/ticks";
import { createClient } from "@/lib/supabase/server";

/**
 * Happening now's record. The timer runs on the phone from the tap; these
 * send its start and stop, at the times the phone recorded, whenever there is
 * a signal. A dog has one running at a time, so a second start joins the
 * first, and the first "It has stopped" is the one kept.
 */

const UNIQUE_VIOLATION = "23505";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartResult = { ok: true } | { joined: { id: string; startedAt: string } } | { failed: true };
export type StopResult = { ok: true } | { alreadyStopped: { endedAt: string } } | { gone: true } | { failed: true };

export async function sendStart(input: { id: string; dogId: string; startedAt: string }): Promise<StartResult> {
  await requireOwner();
  const id = String(input.id);
  const dogId = String(input.dogId);
  const startedAt = queuedTickTime(input.startedAt, new Date());
  if (!UUID.test(id) || !UUID.test(dogId) || !startedAt) return { failed: true };
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    id,
    dog_id: dogId,
    kind: HAPPENING_KIND,
    started_at: startedAt.toISOString(),
    capture_mode: "happening_now",
  });
  if (!error) {
    refresh();
    return { ok: true };
  }
  if (error.code !== UNIQUE_VIOLATION) {
    console.error("[happening] start not saved", { code: error.code, message: error.message });
    return { failed: true };
  }
  // Either this start already arrived, or someone else's timer is running for the dog.
  const { data: rows } = await supabase
    .from("events")
    .select("id, started_at")
    .eq("dog_id", dogId)
    .eq("capture_mode", "happening_now")
    .or(`id.eq.${id},ended_at.is.null`);
  const found = (rows ?? []) as { id: string; started_at: string }[];
  if (found.some((r) => r.id === id)) return { ok: true };
  const running = found[0];
  return running ? { joined: { id: running.id, startedAt: running.started_at } } : { failed: true };
}

export async function sendStop(input: { id: string; endedAt: string; passed: string[] }): Promise<StopResult> {
  await requireOwner();
  const id = String(input.id);
  const endedAt = queuedTickTime(input.endedAt, new Date());
  if (!UUID.test(id) || !endedAt) return { failed: true };
  const passed = Array.isArray(input.passed) ? input.passed.filter((k) => typeof k === "string").slice(0, 20) : [];
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("events")
    .select("started_at, ended_at")
    .eq("id", id)
    .eq("capture_mode", "happening_now")
    .maybeSingle<{ started_at: string; ended_at: string | null }>();
  if (error) {
    console.error("[happening] stop not saved", { code: error.code, message: error.message });
    return { failed: true };
  }
  if (!row) return { gone: true };
  if (row.ended_at) return { alreadyStopped: { endedAt: row.ended_at } };
  const started = Date.parse(row.started_at);
  const ended = Math.max(endedAt.getTime(), started);
  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update({
      ended_at: new Date(ended).toISOString(),
      duration_s: Math.round((ended - started) / 1000),
      thresholds_passed_json: passed,
    })
    .eq("id", id)
    .is("ended_at", null)
    .select("id");
  if (updateError) {
    console.error("[happening] stop not saved", { code: updateError.code, message: updateError.message });
    return { failed: true };
  }
  if ((updated ?? []).length === 0) {
    // Someone else's "It has stopped" landed first.
    const { data: now } = await supabase.from("events").select("ended_at").eq("id", id).maybeSingle<{ ended_at: string | null }>();
    return now?.ended_at ? { alreadyStopped: { endedAt: now.ended_at } } : { failed: true };
  }
  refresh();
  return { ok: true };
}

/** Whether a running capture has been stopped on another phone, or removed, so this one stops counting. */
export async function checkCapture(id: string): Promise<{ running: true } | { stoppedAt: string } | { gone: true } | { failed: true }> {
  await requireOwner();
  if (!UUID.test(String(id))) return { failed: true };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("ended_at")
    .eq("id", id)
    .eq("capture_mode", "happening_now")
    .maybeSingle<{ ended_at: string | null }>();
  if (error) return { failed: true };
  if (!data) return { gone: true };
  return data.ended_at ? { stoppedAt: data.ended_at } : { running: true };
}

export type DetailState = { failed?: boolean; errors?: Record<string, string>; values?: Record<string, string> };

/** Saves whatever detail the owner chose to add. Every field can be left empty; saving finishes it. */
export async function saveCaptureDetail(_state: DetailState, form: FormData): Promise<DetailState> {
  await requireOwner();
  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 1000) return { errors: { note: "Use 1,000 characters or fewer." }, values: { note } };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ note: note || null, detail_complete: true })
    .eq("id", id)
    .eq("capture_mode", "happening_now")
    .not("ended_at", "is", null)
    .select("id");
  if (error || (data ?? []).length === 0) {
    if (error) console.error("[happening] detail not saved", { code: error.code, message: error.message });
    return { failed: true, values: { note } };
  }
  refresh();
  redirect("/today");
}

/** Removes a capture started by mistake. Only the person who started it can. */
export async function removeCapture(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", String(form.get("id") ?? ""))
    .eq("capture_mode", "happening_now")
    .eq("recorded_by", owner.userId);
  if (error) console.error("[happening] capture not removed", { code: error.code, message: error.message });
  refresh();
  redirect("/today");
}
