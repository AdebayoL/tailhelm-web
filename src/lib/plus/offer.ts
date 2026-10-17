import { type LocalDate, addDays, daysBetween } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { FREE_DAYS, historyStart } from "@/lib/history/window";

/**
 * When the day-31 sheet appears, and what it says about the days moving out
 * of view. It is offered once, on the day the household's first record leaves
 * a free account's 30 days, and never ahead of anything that needs the owner.
 */

/**
 * Off until payments exist (Phase 8): "Choose Plus" has nowhere to go before
 * then, so nobody sees the sheet except through the preview link.
 */
export const DAY31_ON = false;

/** The price as the landing page and checkout give it, in pounds including VAT. */
export const PLUS_PRICE = { year: 36, month: 4 } as const;

/** A household that opens the app a few days late still sees it; after a week the moment has passed. */
export const DAY31_WINDOW_DAYS = 7;

export type Day31Moment = {
  /** The first record's day: the month runs from here to today. */
  from: LocalDate;
  /** The days a free account no longer shows: from `from` to the day before the 30 days start. */
  outOfView: { from: LocalDate; to: LocalDate };
  /** 0 on the day the first record leaves view, then 1, 2… while the moment lasts. */
  late: number;
};

export function day31Moment(firstRecordOn: LocalDate | null, today: LocalDate): Day31Moment | null {
  if (!firstRecordOn || firstRecordOn > today) return null;
  const start = historyStart(today, false)!;
  if (firstRecordOn >= start) return null;
  const late = daysBetween(addDays(firstRecordOn, FREE_DAYS), today);
  if (late >= DAY31_WINDOW_DAYS) return null;
  return { from: firstRecordOn, outOfView: { from: firstRecordOn, to: addDays(start, -1) }, late };
}

/**
 * Whether the sheet waits: a dose is due now or late, an injection is due
 * today or overdue, a quick-check alert is showing, or Happening now is on.
 * Today stays exactly as it is until each of these has been dealt with.
 */
export function day31Waits({
  doses,
  injections,
  now,
  alert,
  happeningNow,
}: {
  doses: { status: "given" | "due" | "late"; dueAt: Date }[];
  injections: { daysUntil: number | null }[];
  now: Date;
  alert: boolean;
  happeningNow: boolean;
}): boolean {
  return (
    alert ||
    happeningNow ||
    doses.some((d) => d.status !== "given" && d.dueAt.getTime() <= now.getTime()) ||
    injections.some((c) => c.daysUntil !== null && c.daysUntil <= 0)
  );
}

/** What the free plan now leaves out of view, and that it is kept. */
export function outOfViewText(moment: Day31Moment): string {
  const { from, to } = moment.outOfView;
  // On the day itself only the first day has gone; a few days late, a run of them has.
  if (from === to) {
    return `From today, the free plan shows the latest ${FREE_DAYS} days, so ${dayMonth(from)} moves out of view. It’s kept, never deleted, and appears again with Plus.`;
  }
  return `The free plan shows the latest ${FREE_DAYS} days, so ${dayMonth(from)} to ${dayMonth(to)} are out of view. They’re kept, never deleted, and appear again with Plus.`;
}

/** "17 Sep to 17 Oct 2026", with both years when the month crosses one. */
export function periodText(from: LocalDate, to: LocalDate): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${dayMonth(from)}${sameYear ? "" : ` ${from.slice(0, 4)}`} to ${dayMonth(to)} ${to.slice(0, 4)}`;
}
