"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireOwner } from "@/lib/auth/session";
import { newToken, sha256Hex } from "@/lib/calendar/links";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfig } from "@/lib/push/config";
import { type Outcome, deliver } from "@/lib/push/send";

export type LinkState = { url?: string; failed?: boolean };

/** Apple Calendar, Google Calendar, or any other calendar given the copied link. */
export type CalendarApp = "apple" | "google" | "other";

function calendarApp(raw: FormDataEntryValue | null): CalendarApp {
  return raw === "apple" || raw === "google" ? raw : "other";
}

/** Makes a new calendar link for one calendar app. That app's old link stops. The link is shown once. */
export async function makeCalendarLink(_state: LinkState, form: FormData): Promise<LinkState> {
  await requireOwner();
  const token = newToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("new_calendar_feed", {
    dog: String(form.get("dog_id") ?? ""),
    hash: await sha256Hex(token),
    app: calendarApp(form.get("app")),
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

/** Stops one calendar app's link. A calendar subscribed to it empties on its next refresh. */
export async function stopCalendarLink(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_calendar_feed", {
    dog: String(form.get("dog_id") ?? ""),
    app: calendarApp(form.get("app")),
  });
  if (error) console.error("[calendar] stop failed", { code: error.code, message: error.message });
  refresh();
}

export type PhoneParts = { endpoint: string; p256dh: string; auth: string };

/** Saves this phone so the signed-in person's reminders reach it. */
export async function savePhone(parts: PhoneParts, userAgent: string): Promise<{ ok: boolean }> {
  await requireOwner();
  if (!/^https:\/\//.test(parts.endpoint) || !parts.p256dh || !parts.auth) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    endpoint: parts.endpoint,
    p256dh: parts.p256dh,
    auth: parts.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) console.error("[push] save failed", { code: error.code, message: error.message });
  return { ok: !error };
}

/** Forgets this phone, so nothing more is sent to it. */
export async function forgetPhone(endpoint: string): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("forget_push_subscription", { endpoint });
  if (error) console.error("[push] forget failed", { code: error.code, message: error.message });
}

/** Turns the signed-in person's reminder emails on or off. Only their own. */
export async function setEmailReminders(form: FormData): Promise<void> {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ email_reminders: form.get("on") === "on" })
    .eq("id", owner.userId);
  if (error) console.error("[email] setting failed", { code: error.code, message: error.message });
  refresh();
}

export type TestState = { outcome?: Outcome | "not_set_up" };

/** Sends a test notification to every phone of the person signed in. */
export async function sendTestNotification(): Promise<TestState> {
  const owner = await requireOwner();
  const admin = createAdminClient();
  const config = pushConfig();
  if (!admin || !config) return { outcome: "not_set_up" };
  const now = new Date();
  try {
    const outcome = await deliver(admin, config, owner.userId, null, {
      kind: "test",
      ref: now.toISOString(),
      tag: "test",
      title: "Tailhelm test",
      body: "Reminders reach this phone.",
      url: "/reminders",
      at: now,
    });
    refresh();
    return { outcome };
  } catch (error) {
    console.error("[push] test failed", { message: (error as Error).message });
    return { outcome: "failed" };
  }
}
