"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * A household member's marks on an observation. The database stamps each one
 * with its own time and the member's name, and lets nothing else change.
 */

type Patch = { shown_at?: string; opened_at?: string; dismissed_at?: string | null; added_to_report_at?: string | null };

async function mark(id: string, patch: Patch, onlyUnset?: keyof Patch): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  let q = supabase.from("observations_noticed").update(patch).eq("id", id);
  if (onlyUnset) q = q.is(onlyUnset, null);
  const { error } = await q;
  if (error) console.error("[noticed] mark failed", { code: error.code, message: error.message });
}

/** Shown on Today, or opened: kept from the first time, for the read rate. */
export async function markNoticed(id: string, seen: "shown" | "opened"): Promise<void> {
  const at = new Date().toISOString();
  await (seen === "shown" ? mark(id, { shown_at: at }, "shown_at") : mark(id, { opened_at: at }, "opened_at"));
}

/** Dismissed for the whole household. From its own page, back to Today. */
export async function dismissNoticed(form: FormData): Promise<void> {
  await mark(String(form.get("id") ?? ""), { dismissed_at: new Date().toISOString() });
  if (form.get("back") === "today") redirect("/today");
  refresh();
}

/** In or out of the 90-day summary. */
export async function setNoticedInSummary(form: FormData): Promise<void> {
  const add = form.get("add") === "1";
  await mark(String(form.get("id") ?? ""), { added_to_report_at: add ? new Date().toISOString() : null });
  refresh();
}

/** Noticed on or off for the dog, for everyone in the household. Alerts are not affected. */
export async function setNoticedOff(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dogs")
    .update({ noticed_off: form.get("off") === "1" })
    .eq("id", String(form.get("dog_id") ?? ""));
  if (error) console.error("[noticed] switch failed", { code: error.code, message: error.message });
  refresh();
}
