import { type LocalDate, type LocalTime, zonedTimeToInstant } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { LATE_AFTER_MS, type Today, type TodayItem } from "@/lib/today/today";

/**
 * Which phone notifications are due for one dog, from its Today. Pure, so the
 * wording and timing are tested without a database or a phone.
 *
 * Notifications carry medicine names, times and dates, never a dose, and the
 * only action they ever suggest is to contact the vet.
 */

/** A scheduler run that is late still sends a reminder up to this long after its time. Each is sent once. */
export const CATCH_UP_MS = 60 * 60 * 1000;
/** Days before an injection that the household is reminded (spec: 7 and 2). */
export const INJECTION_NOTICE_DAYS = [7, 2] as const;
/** A dose still not ticked by this time on the owner's clock gets one more email (spec: 21:00). */
export const EVENING: LocalTime = "21:00";

export type NoticeKind =
  | "test"
  | "dose_due"
  | "dose_not_ticked"
  | "dose_evening"
  | "dose_ticked"
  | "injection_soon"
  | "injection_overdue"
  | "test_due";

/** What reaches a phone. The 21:00 message is email only, because the 2-hour notification already reached the phone. */
export const PUSH_KINDS: ReadonlySet<NoticeKind> = new Set(["test", "dose_due", "dose_not_ticked", "dose_ticked", "injection_soon", "injection_overdue", "test_due"]);
/** What is also emailed, as a net under the phone (spec: reminder layer 3). */
export const EMAIL_KINDS: ReadonlySet<NoticeKind> = new Set(["dose_not_ticked", "dose_evening", "injection_soon", "injection_overdue"]);

export type Notice = {
  kind: NoticeKind;
  /** Names the reminder; with the kind it is sent once per person. */
  ref: string;
  /** Notifications with the same tag replace each other on the phone. */
  tag: string;
  title: string;
  body: string;
  url: string;
  at: Date;
};

const owned = (dogName: string, item: TodayItem, fallback: string) => `${dogName}’s ${item.product ?? fallback}`;

/** The tag shared by a dose's reminders and its "ticked" message, so the tick replaces the reminder. */
export const doseTag = (itemId: string, date: LocalDate, slot: LocalTime) => `dose:${itemId}:${date}:${slot}`;

export function dueNotices(today: Today, dogName: string, timeZone: string, now: Date): Notice[] {
  const notices: Notice[] = [];
  const inWindow = (at: Date) => now.getTime() >= at.getTime() && now.getTime() < at.getTime() + CATCH_UP_MS;
  const add = (n: Notice) => {
    if (inWindow(n.at)) notices.push(n);
  };

  for (const dose of today.doses) {
    if (dose.status === "given") continue;
    const ref = `${dose.item.id}:${today.date}:${dose.slot}`;
    const tag = doseTag(dose.item.id, today.date, dose.slot);
    const what = owned(dogName, dose.item, "medicine");
    add({ kind: "dose_due", ref, tag, title: `Time for ${what}`, body: "Check the app before giving.", url: "/today", at: dose.dueAt });
    add({
      kind: "dose_not_ticked",
      ref,
      tag,
      title: `${what} isn’t ticked yet today`,
      body: `It was due at ${dose.slot}.`,
      url: "/today",
      at: new Date(dose.dueAt.getTime() + LATE_AFTER_MS),
    });
    // Only a dose whose 2-hour reminder has already gone gets the evening one.
    const evening = zonedTimeToInstant(today.date, EVENING, timeZone);
    if (dose.dueAt.getTime() + LATE_AFTER_MS <= evening.getTime()) {
      add({
        kind: "dose_evening",
        ref,
        tag,
        title: `${what} still isn’t ticked today`,
        body: `It was due at ${dose.slot}. If it was missed, contact your vet.`,
        url: "/today",
        at: evening,
      });
    }
  }

  for (const c of today.countdowns) {
    if (c.item.schedule_json.kind !== "interval" || c.dueOn === null || c.daysUntil === null) continue;
    const at = zonedTimeToInstant(today.date, c.item.schedule_json.time, timeZone);
    const what = owned(dogName, c.item, "injection");
    if ((INJECTION_NOTICE_DAYS as readonly number[]).includes(c.daysUntil)) {
      add({
        kind: "injection_soon",
        ref: `${c.item.id}:${c.dueOn}:${c.daysUntil}`,
        tag: `injection:${c.item.id}:${c.dueOn}`,
        title: `${what} is due on ${dayMonth(c.dueOn)}`,
        body: "Is it booked?",
        url: "/today",
        at,
      });
    } else if (c.daysUntil === -1) {
      add({
        kind: "injection_overdue",
        ref: `${c.item.id}:${c.dueOn}`,
        tag: `injection:${c.item.id}:${c.dueOn}`,
        title: `${what} is overdue`,
        body: `It was due on ${dayMonth(c.dueOn)}. Contact your vet today.`,
        url: "/today",
        at,
      });
    }
  }

  for (const t of today.tests) {
    if (t.item.schedule_json.kind !== "offset") continue;
    for (const test of t.upcoming ?? []) {
      if (test.daysUntil !== 0) continue;
      add({
        kind: "test_due",
        ref: `${t.item.id}:${test.dueOn}`,
        tag: `test:${t.item.id}:${test.dueOn}`,
        title: `${t.item.product ?? "Blood test"} for ${dogName} around today`,
        body: "As your vet asked.",
        url: "/today",
        at: zonedTimeToInstant(today.date, t.item.schedule_json.time, timeZone),
      });
    }
  }
  return notices;
}

/** What the rest of the household sees the moment a dose is ticked. */
export function tickedNotice(args: {
  dogName: string;
  item: TodayItem;
  date: LocalDate;
  slot: LocalTime;
  extraNo: number;
  by: string;
  at: LocalTime;
  now: Date;
}): Notice {
  const { dogName, item, date, slot, extraNo, by, at, now } = args;
  return {
    kind: "dose_ticked",
    ref: `${item.id}:${date}:${slot}:${extraNo}`,
    tag: doseTag(item.id, date, slot),
    title: `${by} gave ${owned(dogName, item, "medicine")} at ${at}`,
    body: extraNo > 0 ? `Recorded as an extra dose for ${slot}.` : `The ${slot} dose is ticked.`,
    url: "/today",
    at: now,
  };
}
