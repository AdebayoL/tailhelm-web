import { type LocalDate, addDays, daysBetween, toLocal } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import type { Sign } from "@/lib/signs/signs";
import type { Countdown, DoseSlot } from "@/lib/today/today";

/**
 * The vet-visit screen: one page for a vet standing next to the dog. It
 * states what was recorded and when, and nothing else.
 */

export type DoseStatus = { kind: DoseSlot["status"]; text: string; extras: string[] };

/** "Given 08:04 by Adebayo", "Due at 18:00" or "Not recorded · due at 08:00", with any second dose. */
export function doseStatus(d: DoseSlot): DoseStatus {
  const [first, ...rest] = d.ticks;
  const extras = rest.map((t) => `Second dose ${t.at} by ${t.by}`);
  if (first) return { kind: "given", text: `Given ${first.at} by ${first.by}`, extras };
  if (d.status === "late") return { kind: "late", text: `Not recorded · due at ${d.slot}`, extras };
  return { kind: "due", text: `Due at ${d.slot}`, extras };
}

/** "today", "yesterday" or "28 days ago". */
export function daysAgoText(from: LocalDate, today: LocalDate): string {
  const days = daysBetween(from, today);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** "next due today", "next due 20 Oct" or "was due 18 Oct", from the last injection logged. */
export function nextDueText(c: Pick<Countdown, "dueOn" | "daysUntil">): { text: string; date: string } | null {
  if (!c.dueOn || c.daysUntil === null) return null;
  if (c.daysUntil === 0) return { text: "next due today", date: dayMonth(c.dueOn) };
  return { text: `${c.daysUntil > 0 ? "next due" : "was due"} ${dayMonth(c.dueOn)}`, date: "" };
}

export type CheckRow = { taken_at: string; values_json: Record<string, unknown> };

/** A sign on one day: ticked, saved without it, or no check that day. */
export type Mark = "ticked" | "not-ticked" | null;

export type CheckGrid = { days: LocalDate[]; rows: { sign: Sign; marks: Mark[] }[] };

/**
 * The last `days` days of quick checks, oldest first, as a grid of the pack's
 * signs: ticked on a day if any check that day ticked it, not ticked if checks
 * were saved without it, and blank when no check was saved that day.
 */
export function checkGrid(checks: CheckRow[], signs: Sign[], today: LocalDate, timeZone: string, days = 7): CheckGrid {
  const byDay = new Map<LocalDate, Set<string>>();
  for (const c of checks) {
    const date = toLocal(new Date(c.taken_at), timeZone).date;
    const keys = byDay.get(date) ?? new Set<string>();
    for (const [k, v] of Object.entries(c.values_json)) if (v) keys.add(k);
    byDay.set(date, keys);
  }
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  return {
    days: dates,
    rows: signs.map((sign) => ({
      sign,
      marks: dates.map((date) => {
        const keys = byDay.get(date);
        return keys ? (keys.has(sign.key) ? "ticked" : "not-ticked") : null;
      }),
    })),
  };
}
