import "server-only";
import { type LocalDate, type LocalTime, addDays, toLocal } from "@/engine/time";
import { emailConfig } from "@/lib/email/send";
import { pushConfig } from "@/lib/push/config";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Notice } from "./due";
import { audience, channelsFor, loadHouseholds } from "./households";
import { type Gap, type LogRow, expectedNotices, findGaps } from "./reconcile";

/** Once a day, after this time in the UK, the scheduler checks the day before. Every reminder of a day is due by then. */
export const RECONCILE_AFTER: LocalTime = "04:00";
const UNIQUE_VIOLATION = "23505";
const PAGE = 1000;
/** How many gaps are kept with the day's record and the report. */
const KEEP = 200;

export type Reconciliation = { day: LocalDate; expected: number; gaps: Gap[] };

/**
 * The daily reconciliation, run by the first scheduler run after 04:00 UK
 * time: every reminder yesterday should have produced, for each dog on its
 * owner's clock, against the delivery log. The day is claimed in
 * reminder_checks first, so it is checked once however often the scheduler
 * runs. Returns null when there is nothing to check this run.
 */
export async function reconcileYesterday(admin: AdminClient, now: Date): Promise<Reconciliation | null> {
  const uk = toLocal(now, "Europe/London");
  if (uk.time < RECONCILE_AFTER) return null;
  const day = addDays(uk.date, -1);
  const { error: claimError } = await admin.from("reminder_checks").insert({ day });
  if (claimError?.code === UNIQUE_VIOLATION) return null;
  if (claimError) throw new Error(`Could not start the daily check: ${claimError.message}`);

  try {
    const push = !!pushConfig();
    const email = !!emailConfig();
    const h = await loadHouseholds(admin, now, { push, email });
    const expected: { dogId: string; notice: Notice }[] = [];
    for (const dog of h.dogs) {
      const date = addDays(toLocal(now, dog.timeZone).date, -1);
      for (const condition of dog.conditions) {
        const notices = expectedNotices({
          date,
          timeZone: dog.timeZone,
          dogName: dog.name,
          items: condition.items,
          ticks: h.ticks,
          anchors: condition.anchors,
        });
        // Only what the scheduler could have sent: to someone it can reach, by a way that kind of reminder goes.
        for (const notice of notices) {
          if (audience(h, dog, notice).some((p) => channelsFor(h, p, notice.kind).length > 0)) expected.push({ dogId: dog.id, notice });
        }
      }
    }

    const rows = await logRows(admin, h.dogs.map((d) => d.id), expected);
    const gaps = findGaps(expected, rows);
    await admin
      .from("reminder_checks")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        expected: expected.length,
        not_sent: gaps.filter((g) => g.problem === "not_sent").length,
        not_delivered: gaps.filter((g) => g.problem === "not_delivered").length,
        gaps: gaps.slice(0, KEEP),
      })
      .eq("day", day);
    return { day, expected: expected.length, gaps };
  } catch (error) {
    await admin
      .from("reminder_checks")
      .update({ status: "failed", finished_at: new Date().toISOString() })
      .eq("day", day);
    throw error;
  }
}

/** The delivery log for the expected reminders, a page at a time so none is cut off. */
async function logRows(admin: AdminClient, dogIds: string[], expected: { notice: Notice }[]): Promise<LogRow[]> {
  if (expected.length === 0 || dogIds.length === 0) return [];
  const times = expected.map((e) => e.notice.at.getTime());
  const from = new Date(Math.min(...times)).toISOString();
  const to = new Date(Math.max(...times) + 60 * 60 * 1000).toISOString();
  const kinds = [...new Set(expected.map((e) => e.notice.kind))];
  const rows: LogRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await admin
      .from("notifications")
      .select("dog_id, kind, ref, status")
      .in("dog_id", dogIds)
      .in("kind", kinds)
      .gte("scheduled_for", from)
      .lte("scheduled_for", to)
      .order("id")
      .range(start, start + PAGE - 1);
    if (error) throw new Error(`Could not load the delivery log: ${error.message}`);
    rows.push(...((data ?? []) as LogRow[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}
