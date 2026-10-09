import { z } from "zod";
import { ScheduleKind } from "@/packs/schema";
import {
  type LocalDate,
  type LocalTime,
  addDays,
  assertTimeZone,
  daysBetween,
  isLocalDate,
  isLocalTime,
  toLocal,
  zonedTimeToInstant,
} from "./time";

/**
 * The schedule engine.
 *
 * Turns a plan item's schedule, exactly as the owner's vet set it, into dated
 * occurrences in the owner's time zone. The pack names only the schedule kind;
 * every number here (times, interval, offsets, reading spacing) is prescribed.
 * A schedule never holds an amount: doses live on the plan item, as typed.
 */

const Time = z.string().refine(isLocalTime, "Use a 24-hour time such as 08:00");
const Day = z.int().min(0).max(366);

export const PlanSchedule = z.discriminatedUnion("kind", [
  /** Every day at set times, e.g. a glucocorticoid at 08:00. */
  z.strictObject({ kind: z.literal("fixed"), times: z.array(Time).min(1).max(12) }),
  /** Every N days from the last treatment, which sets the anchor, e.g. DOCP. */
  z.strictObject({ kind: z.literal("interval"), everyDays: Day.min(1), time: Time }),
  /** Days after the most recent anchor, rebuilt each cycle, e.g. a blood test. */
  z.strictObject({ kind: z.literal("offset"), offsetsDays: z.array(Day).min(1).max(12), time: Time }),
  /** Several readings within one day once the owner starts, e.g. a glucose curve. */
  z.strictObject({
    kind: z.literal("series"),
    everyMinutes: z.int().min(5).max(720),
    readings: z.int().min(2).max(48),
  }),
  /** Logged when it happens, never scheduled. */
  z.strictObject({ kind: z.literal("event") }),
]);
export type PlanSchedule = z.infer<typeof PlanSchedule>;

export type ParseResult = { ok: true; schedule: PlanSchedule } | { ok: false; message: string };

/**
 * Reads a plan item's stored schedule and checks it has the kind the pack gives
 * that medicine or rule, so a plan item can never use a kind the engine lacks.
 */
export function parsePlanSchedule(raw: unknown, packKind: ScheduleKind): ParseResult {
  const parsed = PlanSchedule.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid schedule" };
  if (parsed.data.kind !== packKind) {
    return { ok: false, message: `The condition pack sets this as ${packKind}, not ${parsed.data.kind}` };
  }
  return { ok: true, schedule: parsed.data };
}

export interface Anchor {
  /** The owner's calendar date of the treatment that started the cycle. */
  anchoredOn: LocalDate;
  cycleNo: number;
}

export interface ScheduleContext {
  /** The owner's IANA time zone, e.g. Europe/London. */
  timeZone: string;
  /** The most recent anchor for the dog's condition, if any treatment has set one. */
  latestAnchor?: Anchor;
  /** When the owner started the current series, if one is running. */
  seriesStartedAt?: Date;
}

export interface Occurrence {
  dueAt: Date;
  localDate: LocalDate;
  localTime: LocalTime;
  /** Interval and offset occurrences: the cycle they belong to. */
  cycleNo?: number;
  /** Offset and interval occurrences: days since the anchor. */
  daysSinceAnchor?: number;
  /** Series occurrences: 1 for the first reading. */
  reading?: number;
}

/** Longest window the engine will expand in one call; the app caches 30 days. */
export const MAX_WINDOW_DAYS = 400;

/**
 * Every occurrence with from <= dueAt < to, earliest first.
 *
 * An interval schedule yields only the next treatment after the latest anchor.
 * Later ones depend on when that treatment is actually given, so projecting
 * them would put dates in the owner's calendar that the vet never set.
 */
export function occurrences(schedule: PlanSchedule, context: ScheduleContext, from: Date, to: Date): Occurrence[] {
  const { timeZone, latestAnchor } = context;
  assertTimeZone(timeZone);
  if (!(to.getTime() > from.getTime())) throw new Error("The window must end after it starts");
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) {
    throw new Error(`The window may span at most ${MAX_WINDOW_DAYS} days`);
  }
  if (latestAnchor && !isLocalDate(latestAnchor.anchoredOn)) throw new Error("The anchor date is not a date");

  const at = (localDate: LocalDate, localTime: LocalTime, extra: Partial<Occurrence> = {}): Occurrence => ({
    dueAt: zonedTimeToInstant(localDate, localTime, timeZone),
    localDate,
    localTime,
    ...extra,
  });

  let found: Occurrence[];
  switch (schedule.kind) {
    case "fixed": {
      const times = [...new Set(schedule.times)].sort();
      const first = addDays(toLocal(from, timeZone).date, -1);
      const last = addDays(toLocal(to, timeZone).date, 1);
      found = [];
      for (let day = first; day <= last; day = addDays(day, 1)) {
        for (const time of times) found.push(at(day, time));
      }
      break;
    }
    case "interval": {
      const next = nextIntervalDue(schedule, context);
      found = next ? [next] : [];
      break;
    }
    case "offset": {
      if (!latestAnchor) return [];
      const offsets = [...new Set(schedule.offsetsDays)].sort((a, b) => a - b);
      found = offsets.map((days) =>
        at(addDays(latestAnchor.anchoredOn, days), schedule.time, {
          cycleNo: latestAnchor.cycleNo,
          daysSinceAnchor: days,
        }),
      );
      break;
    }
    case "series": {
      const start = context.seriesStartedAt;
      if (!start) return [];
      found = Array.from({ length: schedule.readings }, (_, i) => {
        const dueAt = new Date(start.getTime() + i * schedule.everyMinutes * 60_000);
        const local = toLocal(dueAt, timeZone);
        return { dueAt, localDate: local.date, localTime: local.time, reading: i + 1 };
      });
      break;
    }
    case "event":
      return [];
  }

  return found
    .filter((o) => o.dueAt.getTime() >= from.getTime() && o.dueAt.getTime() < to.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

/** Days since the anchor on a given local date, for placing a result in its cycle. */
export function daysSinceAnchor(anchor: Anchor, on: LocalDate): number {
  return daysBetween(anchor.anchoredOn, on);
}

/**
 * The next treatment for an interval schedule, even when its date has passed,
 * so Today can show an overdue injection rather than dropping it.
 */
export function nextIntervalDue(schedule: PlanSchedule, context: ScheduleContext): Occurrence | null {
  if (schedule.kind !== "interval" || !context.latestAnchor) return null;
  assertTimeZone(context.timeZone);
  const { anchoredOn, cycleNo } = context.latestAnchor;
  const localDate = addDays(anchoredOn, schedule.everyDays);
  return {
    dueAt: zonedTimeToInstant(localDate, schedule.time, context.timeZone),
    localDate,
    localTime: schedule.time,
    cycleNo,
    daysSinceAnchor: schedule.everyDays,
  };
}
