/**
 * Calendar dates and wall-clock times in the owner's time zone.
 *
 * Reminders follow the owner's clock, including clock changes: a dose set for
 * 08:00 stays at 08:00 local time when the clocks go forward or back.
 */

/** A calendar date, "YYYY-MM-DD". */
export type LocalDate = string;
/** A wall-clock time, "HH:MM", 24-hour. */
export type LocalTime = string;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export function isLocalDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === value;
}

export function isLocalTime(value: string): boolean {
  return TIME.test(value);
}

function dateParts(date: LocalDate): [number, number, number] {
  const m = DATE.exec(date);
  if (!m || !isLocalDate(date)) throw new Error(`Not a date: ${date}`);
  return [+m[1], +m[2], +m[3]];
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = dateParts(date);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const [fy, fm, fd] = dateParts(from);
  const [ty, tm, td] = dateParts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Throws on a time zone the runtime does not know, so a bad profile fails loudly. */
export function assertTimeZone(timeZone: string): void {
  formatter(timeZone);
}

function wallClock(instant: number, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetMs(instant: number, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The owner's calendar date and time at an instant. */
export function toLocal(instant: Date, timeZone: string): { date: LocalDate; time: LocalTime } {
  const w = wallClock(instant.getTime(), timeZone);
  return { date: `${w.year}-${pad(w.month)}-${pad(w.day)}`, time: `${pad(w.hour)}:${pad(w.minute)}` };
}

/**
 * The instant a wall-clock time happens in a time zone.
 *
 * When the clocks go back the time happens twice; the first is used, so a
 * reminder is never late. When they go forward the time does not exist; the
 * reminder moves forward by the gap (01:30 becomes 02:30 in the UK).
 */
export function zonedTimeToInstant(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const [y, mo, d] = dateParts(date);
  const t = TIME.exec(time);
  if (!t) throw new Error(`Not a time: ${time}`);
  const naive = Date.UTC(y, mo - 1, d, +t[1], +t[2]);

  const before = naive - offsetMs(naive - DAY_MS / 2, timeZone);
  const after = naive - offsetMs(naive + DAY_MS / 2, timeZone);
  const matches = (instant: number) => {
    const local = toLocal(new Date(instant), timeZone);
    return local.date === date && local.time === time;
  };

  const valid = [before, after].filter(matches);
  if (valid.length > 0) return new Date(Math.min(...valid));
  return new Date(before);
}
