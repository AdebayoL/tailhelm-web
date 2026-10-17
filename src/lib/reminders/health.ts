/**
 * Reminder health: which reminder layers have stopped working for one person,
 * for the amber banner on Today (Build Spec, "Reminders": "If a layer later
 * fails, an amber banner sits on the Today screen until it is fixed"). Pure,
 * so each case is tested without a database.
 *
 * A layer someone chose not to set up is not a failure. A layer that worked
 * and stopped is, and so is email turned off, because it is the net under
 * the phone.
 */

/** A calendar link with no fetch for this long has stopped. Calendars refresh on their own schedule, often only every few hours. */
export const CALENDAR_STALE_MS = 48 * 60 * 60 * 1000;

export type CalendarApp = "apple" | "google" | "other";
export type CalendarFeed = { app: CalendarApp; created_at: string; created_by: string | null; last_fetched_at: string | null };

export type HealthFacts = {
  now: Date;
  /** The person signed in. */
  me: string;
  dogName: string;
  /** The dog's calendar links still in use. */
  feeds: CalendarFeed[];
  /** Whether a notification ever reached one of this person's phones. */
  pushEverSent: boolean;
  /** How many phones this person has that can get notifications now. */
  pushPhones: number;
  /** Null when email reminders are not set up on this server. */
  email: { on: boolean; lastFailed: boolean } | null;
};

export type HealthIssue = { key: "calendar" | "push" | "email_off" | "email_failed"; text: string };

const CALENDAR_NAMES: Record<CalendarApp, string> = { apple: "Apple Calendar", google: "Google Calendar", other: "Your calendar" };

/** `day` writes a timestamp as the owner reads a date, such as "12 Oct". */
export function healthIssues(f: HealthFacts, day: (iso: string) => string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Each person's calendar is their own, so only the links they made are theirs to fix.
  const mine = f.feeds.filter((feed) => feed.created_by === f.me);
  const seen = (feed: CalendarFeed) => Date.parse(feed.last_fetched_at ?? feed.created_at);
  const latest = mine.sort((a, b) => seen(b) - seen(a))[0];
  if (latest && f.now.getTime() - seen(latest) >= CALENDAR_STALE_MS) {
    const name = CALENDAR_NAMES[latest.app];
    issues.push({
      key: "calendar",
      text: latest.last_fetched_at
        ? `${name} hasn’t fetched ${f.dogName}’s plan since ${day(latest.last_fetched_at)}.`
        : `${name} hasn’t picked up ${f.dogName}’s plan since the link was made on ${day(latest.created_at)}.`,
    });
  }

  if (f.pushEverSent && f.pushPhones === 0) {
    issues.push({ key: "push", text: "Notifications have stopped reaching your phone." });
  }

  if (f.email && !f.email.on) {
    issues.push({ key: "email_off", text: "Email reminders are off." });
  } else if (f.email?.lastFailed) {
    issues.push({ key: "email_failed", text: "The last reminder email couldn’t be sent." });
  }

  return issues;
}
