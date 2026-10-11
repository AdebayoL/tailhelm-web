"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireOwner } from "@/lib/auth/session";
import { newToken, sha256Hex } from "@/lib/calendar/links";
import { createClient } from "@/lib/supabase/server";

export type LinkState = { url?: string; failed?: boolean };

/** Makes a new calendar link for the dog. The old one stops. The link is shown once. */
export async function makeCalendarLink(_state: LinkState, form: FormData): Promise<LinkState> {
  await requireOwner();
  const token = newToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("new_calendar_feed", {
    dog: String(form.get("dog_id") ?? ""),
    hash: await sha256Hex(token),
  });
  if (error) {
    console.error("[calendar] new link failed", { code: error.code, message: error.message });
    return { failed: true };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  refresh();
  return { url: `${proto}://${host}/calendar/${token}.ics` };
}

/** Stops the calendar link. Calendars subscribed to it empty on their next refresh. */
export async function stopCalendarLink(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_calendar_feed", { dog: String(form.get("dog_id") ?? "") });
  if (error) console.error("[calendar] stop failed", { code: error.code, message: error.message });
  refresh();
}
