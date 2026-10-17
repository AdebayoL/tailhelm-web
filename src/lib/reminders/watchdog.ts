import { type LocalTime, addDays, toLocal, zonedTimeToInstant } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import type { Notice } from "./due";

/**
 * The watchdogs that tell a person their reminders may have stopped reaching
 * them (Build Spec, "The four reminder layers and the watchdogs"): a monthly
 * test notification they confirm by tapping, an email when it goes
 * unconfirmed, and an email when the last phone that got their notifications
 * stops. Pure, so the timing and wording are tested without a database.
 *
 * Like every reminder they carry no dose, and say nothing about the dog's
 * health.
 */

/** A monthly test goes out this many days after the last test was confirmed or sent. */
export const MONTHLY_TEST_DAYS = 30;
/** Monthly tests go out in the day on the person's clock, never at night. */
export const MONTHLY_TEST_FROM: LocalTime = "10:00";
export const MONTHLY_TEST_UNTIL: LocalTime = "20:00";
/** A monthly test not confirmed this long after it was sent is reported, on Today and by email. */
export const CONFIRM_WITHIN_MS = 48 * 60 * 60 * 1000;
/** A reminder health email not sent within this long of what caused it is no longer sent. */
export const HEALTH_EMAIL_WITHIN_MS = 3 * 24 * 60 * 60 * 1000;

/** Where tapping the monthly test goes; the Reminders page records it as received on that phone. */
export const MONTHLY_TEST_URL = "/reminders?test=monthly";

const GONE = "phone gone";

/** How the delivery log records a phone the push service no longer knows, with what kind of device it was. */
export function goneProblem(status: number, device: string): string {
  return `${GONE} (${status}): ${device}`;
}

export function isGoneProblem(problem: string): boolean {
  return problem.startsWith(GONE);
}

/** The device named in a delivery log entry that recorded a phone gone. */
export function goneDevice(detail: string | null): string {
  const match = detail?.match(/phone gone \(\d+\): ([^;]+)/);
  return match ? match[1].trim() : "phone";
}

/** "Bella’s reminders" for someone with one dog, otherwise "Your reminders". */
export function whose(dogNames: string[]): string {
  const names = [...new Set(dogNames)];
  return names.length === 1 ? `${names[0]}’s reminders` : "Your reminders";
}

const latest = (...times: (string | null)[]) =>
  times.filter((t): t is string => !!t).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;

/**
 * The monthly test, when one is due for this person now: 30 days after their
 * last confirmed test or the last monthly test sent, whichever is later, and
 * straight away for someone with neither. Sent once a day at most.
 */
export function monthlyTest(args: { now: Date; timeZone: string; lastConfirmed: string | null; lastTestSent: string | null }): Notice | null {
  const { now, timeZone } = args;
  const local = toLocal(now, timeZone);
  const base = latest(args.lastConfirmed, args.lastTestSent);
  const dueOn = base ? addDays(toLocal(new Date(base), timeZone).date, MONTHLY_TEST_DAYS) : local.date;
  if (dueOn > local.date || local.time < MONTHLY_TEST_FROM || local.time >= MONTHLY_TEST_UNTIL) return null;
  return {
    kind: "monthly_test",
    ref: local.date,
    tag: "monthly-test",
    title: "Monthly reminder test",
    body: "Tap here to confirm Tailhelm’s reminders reach this phone.",
    url: MONTHLY_TEST_URL,
    at: zonedTimeToInstant(local.date, MONTHLY_TEST_FROM, timeZone),
  };
}

/**
 * Whether the last monthly test is still unconfirmed 2 days after it was
 * sent. A test confirmed on any of the person's phones since then counts.
 */
export function testUnconfirmed(args: { now: Date; test: { at: string } | null; lastConfirmed: string | null }): boolean {
  if (!args.test) return false;
  const sent = Date.parse(args.test.at);
  if (args.lastConfirmed && Date.parse(args.lastConfirmed) >= sent) return false;
  return args.now.getTime() - sent >= CONFIRM_WITHIN_MS;
}

/** The email when a monthly test went unconfirmed, to a person who still has a phone set up. */
export function unconfirmedTestEmail(args: {
  now: Date;
  timeZone: string;
  test: { id: string; at: string } | null;
  lastConfirmed: string | null;
  phones: number;
  dogNames: string[];
}): Notice | null {
  const { test } = args;
  if (!test || args.phones === 0 || !testUnconfirmed(args)) return null;
  const at = new Date(Date.parse(test.at) + CONFIRM_WITHIN_MS);
  if (args.now.getTime() - at.getTime() >= HEALTH_EMAIL_WITHIN_MS) return null;
  return {
    kind: "test_unconfirmed",
    ref: test.id,
    tag: `test-unconfirmed:${test.id}`,
    title: `${whose(args.dogNames)} may not reach you`,
    body: `The test notification sent to your phone on ${dayMonth(toLocal(new Date(test.at), args.timeZone).date)} wasn’t confirmed. Open Tailhelm on your phone, go to Reminders and send a test.`,
    url: "/reminders",
    at,
  };
}

/**
 * The email when the last phone that got this person's notifications stopped.
 * `lost` is the most recent delivery that found a phone gone. Someone who has
 * set a phone up again since then is not emailed.
 */
export function phoneLostEmail(args: {
  now: Date;
  timeZone: string;
  lost: { id: string; at: string; detail: string | null } | null;
  phones: number;
  dogNames: string[];
}): Notice | null {
  const { lost } = args;
  if (!lost || args.phones > 0) return null;
  const at = new Date(lost.at);
  if (args.now.getTime() - at.getTime() >= HEALTH_EMAIL_WITHIN_MS) return null;
  const device = goneDevice(lost.detail);
  return {
    kind: "phone_lost",
    ref: lost.id,
    tag: `phone-lost:${lost.id}`,
    title: `${whose(args.dogNames)} can no longer reach your ${device}`,
    body: `Notifications to it stopped on ${dayMonth(toLocal(at, args.timeZone).date)}. This happens when Tailhelm is removed from the Home Screen, its notifications are turned off, or the browser’s data is cleared. Open Tailhelm on your ${device} and turn notifications on again in Reminders.`,
    url: "/reminders",
    at,
  };
}
