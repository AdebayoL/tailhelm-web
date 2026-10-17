import "server-only";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { type Outcome, logOnce, logResult } from "@/lib/notify/log";
import type { Notice } from "@/lib/reminders/due";
import { goneProblem, isGoneProblem } from "@/lib/reminders/watchdog";
import type { AdminClient } from "@/lib/supabase/admin";
import { type PushConfig, isGone } from "./config";
import { deviceName } from "./device";

/** How long a push service holds a notification for a phone that is off. */
const TTL_SECONDS = 4 * 60 * 60;

export type { Outcome };

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null };

/** Sends one notice to one person's phones, once (see logOnce). */
export async function deliver(
  admin: AdminClient,
  config: PushConfig,
  profileId: string,
  dogId: string | null,
  notice: Notice,
): Promise<Outcome> {
  const logged = await logOnce(admin, profileId, dogId, notice, "push");
  if (!logged) return "already_sent";

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_agent")
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
        // Recorded with the kind of device, so the person can be told which one stopped (see phoneLostEmail).
        problems.push(goneProblem(status!, deviceName(sub.user_agent)));
      } else {
        problems.push(status ? `push service ${status}` : String((error as Error).message ?? error).slice(0, 200));
      }
    }
  }

  const status = sent > 0 ? "sent" : (subs ?? []).length === 0 || problems.every(isGoneProblem) ? "no_device" : "failed";
  await logResult(admin, logged, status, problems);
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
