import { type LocalDate, type LocalTime, zonedTimeToInstant } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { LATE_AFTER_MS, type Tick, type Today, type TodayItem } from "@/lib/today/today";

/**
 * Which reminders are due for one dog, from its Today. Pure, so the
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
/** A dose still not ticked this long after its time, or at EVENING if sooner, is passed to another person in the household (spec: reminder layer 4). */
export const ESCALATE_AFTER_MS = 4 * 60 * 60 * 1000;

export type NoticeKind =
  | "test"
  | "dose_due"
  | "dose_not_ticked"
  | "dose_evening"
  | "dose_escalation"
  | "dose_ticked"
  | "injection_soon"
  | "injection_overdue"
  | "test_due";

/** What reaches a phone. The 21:00 message is email only, because the 2-hour notification already reached the phone. */
export const PUSH_KINDS: ReadonlySet<NoticeKind> = new Set(["test", "dose_due", "dose_not_ticked", "dose_escalation", "dose_ticked", "injection_soon", "injection_overdue", "test_due"]);
/** What is also emailed, as a net under the phone (spec: reminder layer 3). */
export const EMAIL_KINDS: ReadonlySet<NoticeKind> = new Set(["dose_not_ticked", "dose_evening", "dose_escalation", "injection_soon", "injection_overdue"]);

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
  /** Set on an escalation: the dose it is about, so the scheduler can leave out the person who usually gives it. */
  escalates?: { itemId: string; slot: LocalTime };
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
    // Escalation changes person: at +4 hours or 21:00, whichever is sooner, but
    // never before the 2-hour reminder has had its chance.
    const escalateAt = Math.max(
      Math.min(dose.dueAt.getTime() + ESCALATE_AFTER_MS, evening.getTime()),
      dose.dueAt.getTime() + LATE_AFTER_MS,
    );
    add({
      kind: "dose_escalation",
      ref,
      tag,
      title: `${what} wasn’t logged today`,
      body: `It was due at ${dose.slot}. If it was missed, contact your vet.`,
      url: "/today",
      at: new Date(escalateAt),
      escalates: { itemId: dose.item.id, slot: dose.slot },
    });
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

/** How far back the scheduler looks to see who usually gives a dose. */
export const USUAL_GIVER_DAYS = 14;

/**
 * Who usually gives this dose: whoever ticked it most over the ticks given,
 * the most recent winning a tie. With no ticks to go on, the dog's owner. An
 * escalation goes to everyone else in the household.
 */
export function usualGiver(ticks: Tick[], itemId: string, slot: string, owner: string | null): string | null {
  const counts = new Map<string, { n: number; last: string }>();
  for (const t of ticks) {
    if (t.plan_item_id !== itemId || t.slot !== slot || !t.given_by_profile) continue;
    const c = counts.get(t.given_by_profile) ?? { n: 0, last: "" };
    counts.set(t.given_by_profile, { n: c.n + 1, last: t.given_at > c.last ? t.given_at : c.last });
  }
  let best: string | null = null;
  let top = { n: 0, last: "" };
  for (const [who, c] of counts) {
    if (c.n > top.n || (c.n === top.n && c.last > top.last)) [best, top] = [who, c];
  }
  return best ?? owner;
}
