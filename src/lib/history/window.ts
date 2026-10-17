import { type LocalDate, addDays } from "@/engine/time";

/** The free plan's history line: today and the 29 days before it, so day 31 is the first to fall outside. */
export const FREE_DAYS = 30;

/**
 * The first day a history screen reaches back to: 30 days on free, or null
 * for everything on Plus. Nothing older is ever deleted; this decides only
 * how far back Past days and Trends show, so the whole history is there the
 * moment a household has Plus. Reminders, the cycle countdown, vet-visit mode
 * and every export ignore it.
 */
export function historyStart(today: LocalDate, plus: boolean): LocalDate | null {
  return plus ? null : addDays(today, -(FREE_DAYS - 1));
}
