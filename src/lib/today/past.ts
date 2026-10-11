import { type LocalDate, type LocalTime, addDays, toLocal } from "@/engine/time";
import type { Sign } from "@/lib/signs/signs";

/** How far back Past days reaches: the free plan's history window. */
export const PAST_DAYS = 30;

export type PastSign = { key: string; label: string; by: string | null; time: LocalTime };
export type PastNote = { id: string; text: string; by: string | null; time: LocalTime | null };
export type PastStress = { id: string; title: string; startsOn: LocalDate; endsOn: LocalDate | null };
export type PastDay = { date: LocalDate; signs: PastSign[]; notes: PastNote[]; stress: PastStress[] };

type CheckRow = { taken_at: string; values_json: Record<string, boolean>; recorded_by: string | null };
type NoteRow = { id: string; started_at: string; note: string; recorded_by: string | null; created_at: string | null };
type StressRow = { id: string; note: string | null; started_at: string; ended_at: string | null };

/**
 * Each day in the window that has something on it, latest first: the signs
 * ticked (first tick of each, with who and when, in the pack's order), the
 * notes about that day, and any stressful day it fell in.
 */
export function pastDays(
  input: { checks: CheckRow[]; notes: NoteRow[]; stress: StressRow[]; signs: Sign[] },
  today: LocalDate,
  timeZone: string,
  days = PAST_DAYS,
): PastDay[] {
  const from = addDays(today, -(days - 1));
  const local = (at: string) => toLocal(new Date(at), timeZone);
  const byDate = new Map<LocalDate, PastDay>();
  const day = (date: LocalDate) => {
    let d = byDate.get(date);
    if (!d) byDate.set(date, (d = { date, signs: [], notes: [], stress: [] }));
    return d;
  };
  const inWindow = (date: LocalDate) => date >= from && date <= today;

  const first = new Map<string, PastSign & { date: LocalDate }>();
  for (const c of [...input.checks].sort((a, b) => a.taken_at.localeCompare(b.taken_at))) {
    const at = local(c.taken_at);
    if (!inWindow(at.date)) continue;
    for (const [key, on] of Object.entries(c.values_json)) {
      const sign = input.signs.find((s) => s.key === key);
      const id = `${at.date}|${key}`;
      if (!on || !sign || first.has(id)) continue;
      first.set(id, { date: at.date, key, label: sign.label, by: c.recorded_by, time: at.time });
    }
  }
  for (const { date, ...sign } of first.values()) day(date).signs.push(sign);
  for (const d of byDate.values())
    d.signs.sort((a, b) => input.signs.findIndex((s) => s.key === a.key) - input.signs.findIndex((s) => s.key === b.key));

  for (const n of [...input.notes].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const on = local(n.started_at);
    if (!inWindow(on.date)) continue;
    // The time only means something when the note was written on the day it is about.
    const written = n.created_at ? local(n.created_at).date : null;
    day(on.date).notes.push({ id: n.id, text: n.note, by: n.recorded_by, time: written === on.date ? on.time : null });
  }

  for (const e of input.stress) {
    const startsOn = local(e.started_at).date;
    const endsOn = e.ended_at ? local(e.ended_at).date : null;
    const stress = { id: e.id, title: e.note ?? "Stressful day", startsOn, endsOn };
    for (let date = startsOn > from ? startsOn : from; date <= (endsOn ?? startsOn) && date <= today; date = addDays(date, 1))
      day(date).stress.push(stress);
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
