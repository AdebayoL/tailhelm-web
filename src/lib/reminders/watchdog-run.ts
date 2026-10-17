import "server-only";
import { type EmailConfig, deliverEmail } from "@/lib/email/send";
import type { Outcome } from "@/lib/notify/log";
import type { PushConfig } from "@/lib/push/config";
import { deliver } from "@/lib/push/send";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Notice } from "./due";
import type { Channel, Households } from "./households";
import { HEALTH_EMAIL_WITHIN_MS, MONTHLY_TEST_DAYS, monthlyTest, phoneLostEmail, unconfirmedTestEmail } from "./watchdog";

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = { id: string; profile_id: string; kind: string; ref: string; created_at: string; detail: string | null };

/**
 * The watchdogs' part of a scheduler run, for everyone in an active dog's
 * household: the monthly test to their phones, and an email to anyone whose
 * test went unconfirmed or whose last phone stopped. The emails go out even
 * with reminder emails off, because they say a reminder has stopped reaching
 * that person. Each is logged and sent once.
 */
export async function runWatchdogs(
  admin: AdminClient,
  h: Households,
  now: Date,
  ready: { push: PushConfig | null; email: EmailConfig | null; appUrl: string; count: (channel: Channel, outcome: Outcome) => void },
): Promise<void> {
  // Both watchdogs are about notifications, so without them there is nothing to watch.
  if (!ready.push) return;
  const profileIds = [...h.people.keys()];
  if (profileIds.length === 0) return;

  const [watched, gone] = await Promise.all([
    admin
      .from("notifications")
      .select("id, profile_id, kind, ref, created_at, detail")
      .in("profile_id", profileIds)
      .in("kind", ["monthly_test", "phone_lost", "test_unconfirmed"])
      .gte("created_at", new Date(now.getTime() - (MONTHLY_TEST_DAYS + 10) * DAY_MS).toISOString())
      .order("created_at", { ascending: false }),
    admin
      .from("notifications")
      .select("id, profile_id, kind, ref, created_at, detail")
      .in("profile_id", profileIds)
      .eq("channel", "push")
      .like("detail", "%phone gone%")
      .gte("created_at", new Date(now.getTime() - HEALTH_EMAIL_WITHIN_MS).toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (watched.error ?? gone.error) throw new Error(`Could not load the watchdog log: ${(watched.error ?? gone.error)!.message}`);
  const watchedRows = (watched.data ?? []) as Row[];
  const goneRows = (gone.data ?? []) as Row[];
  const emailed = new Set(watchedRows.filter((r) => r.kind !== "monthly_test").map((r) => `${r.profile_id}|${r.kind}|${r.ref}`));

  const run = async (channel: Channel, kind: string, go: () => Promise<Outcome>) => {
    try {
      ready.count(channel, await go());
    } catch (error) {
      console.error("[reminders] watchdog failed", { channel, kind, message: (error as Error).message });
      ready.count(channel, "failed");
    }
  };

  for (const person of h.people.values()) {
    const timeZone = person.timezone || "Europe/London";
    const phones = h.phones.get(person.id) ?? { count: 0, lastConfirmed: null };
    const dogNames = h.dogs.filter((d) => d.members.includes(person.id)).map((d) => d.name);
    const lastTest = watchedRows.find((r) => r.profile_id === person.id && r.kind === "monthly_test");
    const lost = goneRows.find((r) => r.profile_id === person.id);

    const test = phones.count > 0 && monthlyTest({ now, timeZone, lastConfirmed: phones.lastConfirmed, lastTestSent: lastTest?.created_at ?? null });
    if (test) await run("push", test.kind, () => deliver(admin, ready.push!, person.id, null, test));

    const address = person.email;
    if (!ready.email || !address?.includes("@")) continue;
    const emails: (Notice | null)[] = [
      unconfirmedTestEmail({
        now,
        timeZone,
        test: lastTest ? { id: lastTest.id, at: lastTest.created_at } : null,
        lastConfirmed: phones.lastConfirmed,
        phones: phones.count,
        dogNames,
      }),
      phoneLostEmail({
        now,
        timeZone,
        lost: lost ? { id: lost.id, at: lost.created_at, detail: lost.detail } : null,
        phones: phones.count,
        dogNames,
      }),
    ];
    for (const notice of emails) {
      if (!notice || emailed.has(`${person.id}|${notice.kind}|${notice.ref}`)) continue;
      await run("email", notice.kind, () => deliverEmail(admin, ready.email!, { id: person.id, email: address }, null, notice, ready.appUrl));
    }
  }
}
