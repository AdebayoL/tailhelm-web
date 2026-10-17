import { type LocalDate, zonedTimeToInstant } from "@/engine/time";
import { type Tick, type TodayItem, buildToday } from "@/lib/today/today";
import { type Notice, type NoticeKind, dayNotices } from "./due";

/**
 * The daily reconciliation (Build Spec, "The four reminder layers and the
 * watchdogs"): the reminders one day should have produced, worked out again
 * from the plan and the ticks, against the delivery log. Pure, so it is
 * tested without a database. A gap is reported to the founder, never shown
 * to an owner.
 */

/** A tick recorded this soon after a reminder's time may have beaten the scheduler's next run, so it excuses the reminder. */
export const TICK_GRACE_MS = 10 * 60 * 1000;

export type PlanItemFact = TodayItem & { createdAt: string };
export type AnchorFact = { anchoredOn: LocalDate; cycleNo: number };

/**
 * The reminders the scheduler should have sent for one condition on one day:
 * each one the day holds, kept only if, at its time, the plan item already
 * existed and the dose was still not ticked.
 */
export function expectedNotices(args: {
  date: LocalDate;
  timeZone: string;
  dogName: string;
  items: PlanItemFact[];
  ticks: Tick[];
  anchors: AnchorFact[];
}): Notice[] {
  const { date, timeZone, dogName } = args;
  // The injection in force that day: the latest one given on or before it.
  const latestAnchor = args.anchors.filter((a) => a.anchoredOn <= date).sort((a, b) => b.cycleNo - a.cycleNo)[0];
  const build = (now: Date, items: TodayItem[], ticks: Tick[]) =>
    buildToday({ now, date, timeZone, me: "", items, ticks, latestAnchor, names: {} });

  const candidates = dayNotices(build(zonedTimeToInstant(date, "00:00", timeZone), args.items, []), dogName, timeZone);
  return candidates.filter((notice) => {
    const at = notice.at.getTime();
    const items = args.items.filter((i) => Date.parse(i.createdAt) <= at);
    const ticks = args.ticks.filter((t) => Date.parse(t.given_at) < at + TICK_GRACE_MS);
    return dayNotices(build(notice.at, items, ticks), dogName, timeZone).some((n) => n.kind === notice.kind && n.ref === notice.ref);
  });
}

export type LogRow = { dog_id: string | null; kind: string; ref: string; status: string };

export type Gap = {
  dogId: string;
  kind: NoticeKind;
  ref: string;
  /** not_sent: nothing was logged for it; not_delivered: it was tried, and reached nobody. */
  problem: "not_sent" | "not_delivered";
};

/** The expected reminders the delivery log shows were never sent, or never reached anyone. */
export function findGaps(expected: { dogId: string; notice: Notice }[], rows: LogRow[]): Gap[] {
  const key = (dogId: string | null, kind: string, ref: string) => `${dogId}|${kind}|${ref}`;
  const statuses = new Map<string, string[]>();
  for (const row of rows) {
    const k = key(row.dog_id, row.kind, row.ref);
    statuses.set(k, [...(statuses.get(k) ?? []), row.status]);
  }
  const gaps: Gap[] = [];
  for (const { dogId, notice } of expected) {
    const found = statuses.get(key(dogId, notice.kind, notice.ref));
    if (!found) gaps.push({ dogId, kind: notice.kind, ref: notice.ref, problem: "not_sent" });
    else if (!found.includes("sent")) gaps.push({ dogId, kind: notice.kind, ref: notice.ref, problem: "not_delivered" });
  }
  return gaps;
}
