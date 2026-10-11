import { type LocalDate, addDays, toLocal } from "@/engine/time";
import type { Sign } from "@/lib/signs/signs";
import type { DoseSlot } from "@/lib/today/today";

/**
 * The vet-visit screen: one page for a vet standing next to the dog. It
 * states what was recorded and when, and nothing else.
 */

/** "08:00 Prednisolone: given at 08:05 by Sam." or "08:00 Prednisolone: not ticked yet." */
export function doseStatusText(d: DoseSlot): string {
  const what = `${d.slot} ${d.item.product ?? "Medicine"}`;
  const first = d.ticks.find((t) => !t.extra);
  if (!first) return `${what}: not ticked yet.`;
  const extras = d.ticks.filter((t) => t.extra).length;
  const extra = extras > 0 ? ` Extra dose${extras > 1 ? "s" : ""} logged: ${extras}.` : "";
  return `${what}: given at ${first.at} by ${first.by}.${extra}`;
}

export type CheckRow = { taken_at: string; values_json: Record<string, unknown> };
export type WellbeingDay = { date: LocalDate; text: string };

/**
 * The last `days` days of quick checks, newest first: the signs noticed each
 * day, "Nothing noticed" when checks were saved with none, or "No check saved".
 */
export function wellbeingDays(
  checks: CheckRow[],
  signs: Sign[],
  today: LocalDate,
  timeZone: string,
  days = 7,
): WellbeingDay[] {
  const byDay = new Map<LocalDate, Set<string>>();
  for (const c of checks) {
    const date = toLocal(new Date(c.taken_at), timeZone).date;
    const keys = byDay.get(date) ?? new Set<string>();
    for (const [k, v] of Object.entries(c.values_json)) if (v) keys.add(k);
    byDay.set(date, keys);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, -i);
    const keys = byDay.get(date);
    if (!keys) return { date, text: "No check saved." };
    const labels = signs.filter((s) => keys.has(s.key)).map((s) => s.label);
    return { date, text: labels.length ? `${labels.join(", ")}.` : "Nothing noticed." };
  });
}
