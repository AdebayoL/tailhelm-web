import "server-only";
import { createHash } from "node:crypto";
import webpush from "web-push";
import type { Notice } from "@/lib/reminders/due";
import type { AdminClient } from "@/lib/supabase/admin";
import { type PushConfig, isGone } from "./config";

const UNIQUE_VIOLATION = "23505";
/** How long a push service holds a notification for a phone that is off. */
const TTL_SECONDS = 4 * 60 * 60;

export type Outcome = "sent" | "no_device" | "failed" | "already_sent";

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends one notice to one person's phones, once. The delivery log row is
 * written first, and its unique key means a second run, or two runs at the
 * same moment, cannot send the same reminder to the same person again.
 */
export async function deliver(
  admin: AdminClient,
  config: PushConfig,
  profileId: string,
  dogId: string | null,
  notice: Notice,
): Promise<Outcome> {
  const { data: logged, error: logError } = await admin
    .from("notifications")
    .insert({
      profile_id: profileId,
      dog_id: dogId,
      kind: notice.kind,
      ref: notice.ref,
      title: notice.title,
      scheduled_for: notice.at.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (logError?.code === UNIQUE_VIOLATION) return "already_sent";
  if (logError || !logged) throw new Error(`Could not log a notification: ${logError?.message}`);

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);
  if (subsError) throw new Error(`Could not load phones: ${subsError.message}`);

  const payload = JSON.stringify({ title: notice.title, body: notice.body, url: notice.url, tag: notice.tag });
  let sent = 0;
  const problems: string[] = [];
  for (const sub of (subs ?? []) as Subscription[]) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        vapidDetails: config,
        TTL: TTL_SECONDS,
        urgency: "high",
        topic: topic(notice.tag),
      });
      sent++;
      await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (isGone(status)) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        problems.push(`phone gone (${status})`);
      } else {
        problems.push(status ? `push service ${status}` : String((error as Error).message ?? error).slice(0, 200));
      }
    }
  }

  const status: Outcome = sent > 0 ? "sent" : (subs ?? []).length === 0 || problems.every((p) => p.startsWith("phone gone")) ? "no_device" : "failed";
  await admin
    .from("notifications")
    .update({ status, sent_at: sent > 0 ? new Date().toISOString() : null, detail: problems.length ? problems.join("; ") : null })
    .eq("id", logged.id);
  return status;
}

/**
 * Push services replace a waiting notification that has the same topic, so a
 * phone that was off gets the latest word on a dose rather than all of them.
 * Topics are at most 32 URL-safe characters.
 */
function topic(tag: string): string {
  return createHash("sha256").update(tag).digest("base64url").slice(0, 32);
}
