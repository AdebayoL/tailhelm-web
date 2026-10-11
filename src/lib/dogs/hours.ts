import { type LocalDate, type LocalTime, isLocalTime, toLocal } from "@/engine/time";

/**
 * A practice's opening hours as the owner saved them from its website or
 * door: one span a day, Monday first, or open around the clock. A span that
 * closes before it opens runs past midnight, as out-of-hours services do.
 * Emergency uses them only to choose which number to show first; with none
 * saved, the dog's own vet comes first.
 */
export type Span = [open: LocalTime, close: LocalTime];
export type Hours = { always: true } | { week: (Span | null)[] };

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const BOTH = "Enter both times for each day it opens, such as 08:00 and 19:00, or leave both blank on a day it is closed.";

/** Reads `${prefix}_always`, or `${prefix}_${day}_open` and `_close` for days 0 (Monday) to 6. Null when nothing was entered. */
export function parseHours(form: FormData, prefix: string): { ok: true; value: Hours | null } | { ok: false; error: string } {
  if (form.get(`${prefix}_always`) === "on") return { ok: true, value: { always: true } };
  const week: (Span | null)[] = [];
  for (let day = 0; day < 7; day++) {
    const open = String(form.get(`${prefix}_${day}_open`) ?? "").trim();
    const close = String(form.get(`${prefix}_${day}_close`) ?? "").trim();
    if (!open && !close) {
      week.push(null);
      continue;
    }
    if (!isLocalTime(open) || !isLocalTime(close) || open === close) return { ok: false, error: BOTH };
    week.push([open, close]);
  }
  return { ok: true, value: week.some(Boolean) ? { week } : null };
}

/** Whatever was stored, as hours or nothing: a row saved by hand that does not fit is ignored rather than trusted. */
export function readHours(raw: unknown): Hours | null {
  if (!raw || typeof raw !== "object") return null;
  if ((raw as { always?: unknown }).always === true) return { always: true };
  const week = (raw as { week?: unknown }).week;
  if (!Array.isArray(week) || week.length !== 7) return null;
  const ok = week.every((s) => s === null || (Array.isArray(s) && s.length === 2 && s.every((t) => typeof t === "string" && isLocalTime(t))));
  return ok ? { week: week as (Span | null)[] } : null;
}

/** "Mon–Fri 08:00–19:00", "Sat 09:00–13:00", or "Open 24 hours". Closed days are left out. */
export function hoursLines(hours: Hours): string[] {
  if ("always" in hours) return ["Open 24 hours"];
  const lines: string[] = [];
  let start = 0;
  for (let day = 1; day <= 7; day++) {
    const prev = hours.week[day - 1];
    const same = day < 7 && prev && hours.week[day] && hours.week[day]![0] === prev[0] && hours.week[day]![1] === prev[1];
    if (same) continue;
    if (prev) lines.push(`${start === day - 1 ? WEEKDAYS[start] : `${WEEKDAYS[start]}–${WEEKDAYS[day - 1]}`} ${prev[0]}–${prev[1]}`);
    start = day;
  }
  return lines;
}

/** 0 for Monday to 6 for Sunday. */
function weekday(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

const overnight = (s: Span) => s[1] < s[0];

/** Open at this moment on the owner's clock. */
export function isOpen(hours: Hours, now: Date, timeZone: string): boolean {
  if ("always" in hours) return true;
  const { date, time } = toLocal(now, timeZone);
  const day = weekday(date);
  const today = hours.week[day];
  const yesterday = hours.week[(day + 6) % 7];
  if (today && (overnight(today) ? time >= today[0] : time >= today[0] && time < today[1])) return true;
  return !!yesterday && overnight(yesterday) && time < yesterday[1];
}

/** When a closed practice next opens: "08:00" later today, or "Tue 08:00". */
export function nextOpening(hours: Hours, now: Date, timeZone: string): string | null {
  if ("always" in hours) return null;
  const { date, time } = toLocal(now, timeZone);
  const day = weekday(date);
  const today = hours.week[day];
  if (today && time < today[0]) return today[0];
  for (let k = 1; k <= 7; k++) {
    const span = hours.week[(day + k) % 7];
    if (span) return `${WEEKDAYS[(day + k) % 7]} ${span[0]}`;
  }
  return null;
}

/** When an open practice closes: "19:00". */
function closing(hours: Hours, now: Date, timeZone: string): string | null {
  if ("always" in hours) return null;
  const { date, time } = toLocal(now, timeZone);
  const day = weekday(date);
  const yesterday = hours.week[(day + 6) % 7];
  if (yesterday && overnight(yesterday) && time < yesterday[1]) return yesterday[1];
  return hours.week[day]?.[1] ?? null;
}

/** "open 24 hours", "open until 19:00", "opens 08:00", or null with no hours saved. */
export function hoursNow(hours: Hours | null, now: Date, timeZone: string): string | null {
  if (!hours) return null;
  if ("always" in hours) return "open 24 hours";
  if (isOpen(hours, now, timeZone)) {
    const until = closing(hours, now, timeZone);
    return until ? `open until ${until}` : null;
  }
  const next = nextOpening(hours, now, timeZone);
  return next ? `opens ${next}` : null;
}

export type Practice = { name: string | null; phone: string | null; hours: Hours | null };
export type Call = { title: string; sub: string | null; phone: string };

/**
 * Which number Emergency shows first. The dog's own vet comes first unless
 * the owner saved its opening hours and it is closed now, when the
 * out-of-hours number leads. The reason is said beneath the buttons.
 */
export function emergencyCalls(
  own: Practice,
  ooh: Practice,
  now: Date,
  timeZone: string,
): { first: Call | null; second: Call | null; why: string | null } {
  const ownName = own.name ?? "your vet";
  const ownCall: Call | null = own.phone
    ? { title: `Call ${ownName}`, sub: ["Your own vet", hoursNow(own.hours, now, timeZone)].filter(Boolean).join(" · "), phone: own.phone }
    : null;
  const oohCall: Call | null = ooh.phone
    ? { title: "Call out-of-hours vet", sub: [ooh.name, hoursNow(ooh.hours, now, timeZone)].filter(Boolean).join(" · ") || null, phone: ooh.phone }
    : null;
  if (!ownCall || !oohCall) return { first: ownCall ?? oohCall, second: null, why: null };
  if (!own.hours) return { first: ownCall, second: oohCall, why: "If your own vet is closed, call the out-of-hours number." };
  const why = `Order chosen from the opening hours you saved for ${ownName}.`;
  return isOpen(own.hours, now, timeZone) ? { first: ownCall, second: oohCall, why } : { first: oohCall, second: ownCall, why };
}
