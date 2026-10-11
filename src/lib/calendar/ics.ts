import { type LocalDate, type LocalTime, addDays, daysBetween, toLocal } from "@/engine/time";
import { PlanSchedule } from "@/engine/schedule";

/**
 * Reminder layer 1: the private calendar feed. A calendar app fetches it with
 * no sign-in and fires its own alarms, so reminders still arrive with
 * Tailhelm closed, deleted or offline. It names medicines and dates only:
 * never a dose.
 */

export type FeedItem = { id: string; product: string | null; schedule: unknown };
export type Feed =
  | { dog_name: string; live: false }
  | {
      dog_name: string;
      live: true;
      time_zone: string;
      items: FeedItem[];
      anchor: { anchored_on: LocalDate; cycle_no: number } | null;
    };

/** Text escaped for an iCalendar property value. */
export function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded, as the iCalendar standard requires. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const localStamp = (date: LocalDate, time: LocalTime) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

const LONDON = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/London",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:BST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

type Alarm = { before: string; text: string };
type CalEvent = {
  uid: string;
  date: LocalDate;
  time: LocalTime;
  summary: string;
  description: string;
  daily?: boolean;
  alarms: Alarm[];
};

const formatDay = (d: LocalDate) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The events the feed carries from today on: each daily dose, the next injection and this cycle's tests. */
export function feedEvents(feed: Feed, now: Date): CalEvent[] {
  if (!feed.live) return [];
  const dog = feed.dog_name;
  const today = toLocal(now, feed.time_zone).date;
  const events: CalEvent[] = [];
  for (const item of feed.items) {
    const parsed = PlanSchedule.safeParse(item.schedule);
    if (!parsed.success) continue;
    const s = parsed.data;
    const product = item.product ?? "medicine";
    if (s.kind === "fixed") {
      for (const time of s.times) {
        events.push({
          uid: `${item.id}-${time.replace(":", "")}`,
          date: today,
          time,
          daily: true,
          summary: `${dog}: ${product}`,
          description: `Time for ${dog}’s ${product}. Check the app before giving.`,
          alarms: [{ before: "PT0M", text: `Time for ${dog}’s ${product}.` }],
        });
      }
    } else if (s.kind === "interval" && feed.anchor) {
      const due = addDays(feed.anchor.anchored_on, s.everyDays);
      if (daysBetween(today, due) < -1) continue;
      const ask = `${dog}’s ${product} is due on ${formatDay(due)}. Is it booked?`;
      events.push({
        uid: `${item.id}-cycle-${feed.anchor.cycle_no + 1}`,
        date: due,
        time: s.time,
        summary: `${dog}: ${product} due`,
        description: ask,
        alarms: [
          { before: "-P7D", text: ask },
          { before: "-P2D", text: ask },
          { before: "PT0M", text: `${dog}’s ${product} is due today.` },
        ],
      });
    } else if (s.kind === "offset" && feed.anchor) {
      for (const day of [...new Set(s.offsetsDays)].sort((a, b) => a - b)) {
        const on = addDays(feed.anchor.anchored_on, day);
        if (on < today) continue;
        events.push({
          uid: `${item.id}-cycle-${feed.anchor.cycle_no}-day-${day}`,
          date: on,
          time: s.time,
          summary: `${dog}: ${product}`,
          description: `${product} for ${dog} around today, as your vet asked.`,
          alarms: [{ before: "PT0M", text: `${product} for ${dog} around today, as your vet asked.` }],
        });
      }
    }
  }
  return events;
}

export function buildCalendar(feed: Feed, now: Date): string {
  const tz = feed.live ? feed.time_zone : "Europe/London";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tailhelm//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`Tailhelm · ${feed.dog_name}`)}`,
    `X-WR-TIMEZONE:${tz}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...(tz === "Europe/London" ? LONDON : []),
  ];
  for (const e of feedEvents(feed, now)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@tailhelm.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=${tz}:${localStamp(e.date, e.time)}`,
      "DURATION:PT15M",
      ...(e.daily ? ["RRULE:FREQ=DAILY"] : []),
      `SUMMARY:${icsText(e.summary)}`,
      `DESCRIPTION:${icsText(e.description)}`,
      "TRANSP:TRANSPARENT",
    );
    for (const a of e.alarms) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${a.before}`, `DESCRIPTION:${icsText(a.text)}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
