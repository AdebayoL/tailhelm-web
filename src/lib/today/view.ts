import { type LocalDate, type LocalTime, addDays, daysBetween, zonedTimeToInstant } from "@/engine/time";
import type { TodayItem } from "./today";

/** Where a time of day sits on the day rail, from 0 at midnight to 100 at the next. */
export function dayPercent(time: LocalTime): number {
  const [h, m] = time.split(":").map(Number);
  return ((h * 60 + m) / 1440) * 100;
}

/** The first dose on a day, for the next-dose card once everything due today is recorded. */
export function firstDoseOn(
  items: TodayItem[],
  date: LocalDate,
  timeZone: string,
): { item: TodayItem; slot: LocalTime; dueAt: Date } | null {
  const first = items
    .flatMap((item) => (item.schedule_json.kind === "fixed" ? item.schedule_json.times.map((slot) => ({ item, slot })) : []))
    .sort((a, b) => a.slot.localeCompare(b.slot))[0];
  return first ? { ...first, dueAt: zonedTimeToInstant(date, first.slot, timeZone) } : null;
}

export type CycleCell = "past" | "today" | "due" | "";

/**
 * The injection cycle, one cell a day from the day after the last injection
 * to the day it is due: days gone, today, and the due day outlined.
 */
export function cycleCells(lastOn: LocalDate, today: LocalDate, everyDays: number): { day: number; cells: CycleCell[] } {
  const day = daysBetween(lastOn, today);
  const cells = Array.from({ length: everyDays }, (_, i): CycleCell => {
    const d = i + 1;
    return d < day ? "past" : d === day ? "today" : d === everyDays ? "due" : "";
  });
  return { day, cells };
}

/** The date a cycle is due, from the last injection. */
export function cycleDueOn(lastOn: LocalDate, everyDays: number): LocalDate {
  return addDays(lastOn, everyDays);
}
