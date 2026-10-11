import type { LocalDate } from "@/engine/time";
import type { PlanSchedule } from "@/engine/schedule";

/**
 * What a record is about, as the design colours it: indigo for a daily
 * medicine, plum for an injection on a cycle, ocean for a measurement. It
 * never says anything about a status or about the dog's health.
 */
export type Jewel = "pred" | "zyc" | "meas";

export function jewelOf(schedule: Pick<PlanSchedule, "kind">): Jewel {
  if (schedule.kind === "interval") return "zyc";
  if (schedule.kind === "offset") return "meas";
  return "pred";
}

/** The class that colours a medicine's name and gives it a key square. */
export function jewelClass(schedule: Pick<PlanSchedule, "kind">): string {
  return `m-${jewelOf(schedule)}`;
}

/** The two letters on a medicine's tile: "Pr" for Prednisolone. */
export function tileLetters(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  return letters ? letters.charAt(0).toUpperCase() + letters.charAt(1).toLowerCase() : "";
}

/**
 * The words and ring beside the dog's name: "Zycortal in 9 days · day 19 of
 * 28", or the date it was due once every day of the cycle has passed. Null
 * until the first injection is recorded, since the cycle starts from it.
 */
export function cycleView(
  product: string,
  countdown: { dueOn: LocalDate | null; daysUntil: number | null },
  everyDays: number,
  formatDate: (d: LocalDate) => string,
): { line: string; day: number; overdue: boolean; label: string; fullLabel: string } | null {
  const { dueOn, daysUntil } = countdown;
  if (dueOn === null || daysUntil === null) return null;
  if (daysUntil < 0) {
    return {
      line: `${product} was due on ${formatDate(dueOn)}`,
      day: everyDays,
      overdue: true,
      label: `${product} cycle: all ${everyDays} days passed`,
      fullLabel: `${product} cycle: all ${everyDays} days passed, injection due ${formatDate(dueOn)}`,
    };
  }
  const day = everyDays - daysUntil;
  const of = `day ${day} of ${everyDays}`;
  return {
    line: daysUntil === 0 ? `${product} due today · ${of}` : `${product} in ${daysUntil} ${daysUntil === 1 ? "day" : "days"} · ${of}`,
    day,
    overdue: false,
    label: `${product} cycle: ${of}`,
    fullLabel: `${product} cycle: ${of}`,
  };
}
