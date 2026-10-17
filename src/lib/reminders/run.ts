import "server-only";
import { emailConfig, deliverEmail } from "@/lib/email/send";
import type { Outcome } from "@/lib/notify/log";
import { addDays, toLocal } from "@/engine/time";
import { pushConfig } from "@/lib/push/config";
import { deliver } from "@/lib/push/send";
import type { AdminClient } from "@/lib/supabase/admin";
import { buildToday } from "@/lib/today/today";
import { type Notice, dueNotices } from "./due";
import { type Channel, audience, channelsFor, loadHouseholds, reachable } from "./households";
import { runWatchdogs } from "./watchdog-run";

type Counts = Partial<Record<Outcome, number>>;
export type RunSummary = { dogs: number; notices: number; push: Counts; email: Counts };

/**
 * One scheduler run: for every active dog with someone a reminder can reach,
 * work out what is due now on the owner's clock and send it to each person in
 * the household, by notification on their phones and, for the reminders the
 * spec emails, by email. A dose still missed hours later is passed to the
 * rest of the household (reminder layer 4). Then the watchdogs: the monthly
 * test, and an email to anyone whose reminders have stopped reaching them.
 * Safe to run as often as wanted, because each reminder is logged and sent
 * once per person per channel.
 */
export async function runReminders(admin: AdminClient, now: Date, appUrl: string): Promise<RunSummary> {
  const push = pushConfig();
  const email = emailConfig();
  if (!push && !email) throw new Error("Set the VAPID keys or RESEND_API_KEY");
  const summary: RunSummary = { dogs: 0, notices: 0, push: {}, email: {} };
  const h = await loadHouseholds(admin, now, { push: !!push, email: !!email });

  const count = (channel: Channel, outcome: Outcome) => {
    summary[channel][outcome] = (summary[channel][outcome] ?? 0) + 1;
  };
  const send = async (person: string, dogId: string, notice: Notice) => {
    for (const channel of channelsFor(h, person, notice.kind)) {
      const address = h.people.get(person)?.email;
      let outcome: Outcome;
      try {
        if (channel === "push") outcome = await deliver(admin, push!, person, dogId, notice);
        else outcome = await deliverEmail(admin, email!, { id: person, email: address! }, dogId, notice, appUrl);
      } catch (error) {
        console.error("[reminders] send failed", { channel, kind: notice.kind, message: (error as Error).message });
        outcome = "failed";
      }
      count(channel, outcome);
    }
  };

  for (const dog of h.dogs) {
    if (reachable(h, dog).length === 0) continue;
    summary.dogs++;
    const today = toLocal(now, dog.timeZone).date;
    for (const condition of dog.conditions) {
      if (condition.items.length === 0) continue;
      const latest = [...condition.anchors].sort((a, b) => b.cycleNo - a.cycleNo)[0];
      // Yesterday too, so a dose due late in the evening still gets its reminders after midnight.
      for (const date of [addDays(today, -1), today]) {
        const day = buildToday({ now, date, timeZone: dog.timeZone, me: "", items: condition.items, ticks: h.ticks, latestAnchor: latest, names: {} });
        for (const notice of dueNotices(day, dog.name, dog.timeZone, now)) {
          const to = audience(h, dog, notice);
          if (to.length === 0) continue;
          summary.notices++;
          for (const person of to) await send(person, dog.id, notice);
        }
      }
    }
  }

  await runWatchdogs(admin, h, now, { push, email, appUrl, count });
  return summary;
}
