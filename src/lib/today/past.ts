import { type LocalDate, type LocalTime, addDays, toLocal } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { historyStart } from "@/lib/history/window";
import type { Sign } from "@/lib/signs/signs";
import { type Scale, WEIGHT_TYPE, kgFigure } from "@/lib/weight/input";

/** The event kind of a stressful day the household plans or records. */
export const STRESS_EVENT_KIND = "stressful_event";

/**
 * Past days: each day's records as the household kept them, grouped by
 * month. Each record carries its mark (indigo for a daily medicine, plum for
 * an injection, ocean for a measurement, an outline for checks and notes)
 * and who recorded it. Only what was recorded shows; nothing marks a day for
 * what wasn't.
 */

export type RecordMark = "pred" | "zyc" | "meas" | "chk" | "note";
/** The filter a record falls under: doses, checks and notes, or measurements. */
export type RecordGroup = "doses" | "checks" | "measurements";

export type RecordKind = "dose" | "extra" | "injection" | "check" | "weight" | "lab" | "note" | "stress";

export type PastRecord = {
  id: string;
  kind: RecordKind;
  mark: RecordMark;
  group: RecordGroup;
  /** The time it was for, or null when it covers the day or was entered for it later. */
  time: LocalTime | null;
  text: string;
  /** The household member who recorded it. */
  by: string | null;
};
export type PastDay = { date: LocalDate; records: PastRecord[] };

export type PastMonth = {
  /** "2026-10", also the anchor the month strip links to. */
  key: string;
  days: PastDay[];
  /** The first day shown, when the history starts partway through the month. */
  from: LocalDate | null;
  doses: number;
  injections: number;
  weights: number;
  labs: number;
};

type ItemRow = { id: string; product: string | null; schedule_json: { kind: string } };
type DoseRow = {
  id: string;
  plan_item_id: string;
  given_at: string;
  given_on: string;
  slot: string;
  extra_no: number;
  given_by_profile: string | null;
  given_by: string | null;
  note: string | null;
};
type ObservationRow = {
  id: string;
  type_key: string;
  taken_at: string;
  created_at: string | null;
  values_json: Record<string, unknown>;
  scale: Scale | null;
  recorded_by: string | null;
};
type NoteRow = { id: string; started_at: string; note: string; recorded_by: string | null; created_at: string | null };
type StressRow = { id: string; note: string | null; started_at: string; ended_at: string | null; recorded_by?: string | null };

export type PastInput = {
  items: ItemRow[];
  doses: DoseRow[];
  observations: ObservationRow[];
  notes: NoteRow[];
  stress: StressRow[];
  /** The pack's quick-check signs, and the key of its check. */
  signs: Sign[];
  signsKey: string | null;
  /** The pack's lab result types. */
  labTypes: { key: string; name: string }[];
};

const SCALE_WORDS: Record<Scale | "none", string> = { clinic: "clinic scale", home: "home scale", none: "scale not recorded" };

/**
 * Each day from `from` (null for every day recorded) to today that has a
 * record on it, latest first, with its records in the order of the day.
 */
export function pastDays(input: PastInput, today: LocalDate, timeZone: string, from: LocalDate | null = historyStart(today, false)): PastDay[] {
  const local = (at: string) => toLocal(new Date(at), timeZone);
  const byDate = new Map<LocalDate, PastRecord[]>();
  const inWindow = (date: LocalDate) => (from === null || date >= from) && date <= today;
  const add = (date: LocalDate, record: PastRecord) => {
    if (!inWindow(date)) return;
    byDate.set(date, [...(byDate.get(date) ?? []), record]);
  };
  // A time means something only when the record was made on the day it is about.
  const timeOn = (date: LocalDate, at: string, made: string | null) => (made === null || local(made).date === date ? local(at).time : null);

  const items = new Map(input.items.map((i) => [i.id, i]));
  for (const d of input.doses) {
    const item = items.get(d.plan_item_id);
    const kind = item?.schedule_json.kind;
    if (!item || (kind !== "fixed" && kind !== "interval")) continue;
    const product = item.product ?? "Medicine";
    const given = local(d.given_at);
    const sameDay = given.date === d.given_on;
    if (kind === "interval") {
      add(d.given_on, {
        id: d.id,
        kind: "injection",
        mark: "zyc",
        group: "doses",
        time: sameDay ? given.time : null,
        text: `${product} injection${d.given_by ? ` · ${d.given_by}` : ""}`,
        by: d.given_by_profile,
      });
    } else if (d.extra_no > 0) {
      add(d.given_on, {
        id: d.id,
        kind: "extra",
        mark: "pred",
        group: "doses",
        time: sameDay ? given.time : null,
        text: `Extra ${product}${d.note ? `, ${d.note}` : ""}`,
        by: d.given_by_profile,
      });
    } else {
      add(d.given_on, {
        id: d.id,
        kind: "dose",
        mark: "pred",
        group: "doses",
        time: d.slot as LocalTime,
        text: `${product} · given ${sameDay ? given.time : `${dayMonth(given.date)}, ${given.time}`}`,
        by: d.given_by_profile,
      });
    }
  }

  const labs = new Map(input.labTypes.map((t) => [t.key, t.name]));
  for (const o of input.observations) {
    const on = local(o.taken_at).date;
    if (o.type_key === input.signsKey) {
      const ticked = input.signs.filter((s) => o.values_json[s.key] === true).map((s) => s.label);
      if (ticked.length === 0) continue;
      add(on, { id: o.id, kind: "check", mark: "chk", group: "checks", time: local(o.taken_at).time, text: `Quick check: ${ticked.join(", ")}`, by: o.recorded_by });
    } else if (o.type_key === WEIGHT_TYPE && typeof o.values_json.kg === "number") {
      add(on, {
        id: o.id,
        kind: "weight",
        mark: "meas",
        group: "measurements",
        time: timeOn(on, o.taken_at, o.created_at),
        text: `Weight ${kgFigure(o.values_json.kg)} kg · ${SCALE_WORDS[o.scale ?? "none"]}`,
        by: o.recorded_by,
      });
    } else if (labs.has(o.type_key)) {
      add(on, { id: o.id, kind: "lab", mark: "meas", group: "measurements", time: timeOn(on, o.taken_at, o.created_at), text: `Lab report: ${labs.get(o.type_key)}`, by: o.recorded_by });
    }
  }

  for (const n of input.notes) {
    const on = local(n.started_at).date;
    add(on, { id: n.id, kind: "note", mark: "note", group: "checks", time: timeOn(on, n.started_at, n.created_at), text: `Note: ${n.note}`, by: n.recorded_by });
  }

  for (const e of input.stress) {
    const startsOn = local(e.started_at).date;
    const endsOn = e.ended_at ? local(e.ended_at).date : startsOn;
    for (let date = from === null || startsOn > from ? startsOn : from; date <= endsOn && date <= today; date = addDays(date, 1)) {
      add(date, { id: `${e.id}|${date}`, kind: "stress", mark: "note", group: "checks", time: null, text: `Stressful day: ${e.note ?? "no details given"}`, by: e.recorded_by ?? null });
    }
  }

  // A stressful day first, then records with no time, then by time; records at the same time keep the order they were made.
  const rank = (r: PastRecord) => (r.kind === "stress" ? "0" : r.time === null ? "1" : `2${r.time}`);
  const order = (a: PastRecord, b: PastRecord) => rank(a).localeCompare(rank(b));
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, records]) => ({ date, records: records.sort(order) }));
}

/** The days in months, latest first, with what each month holds for its heading. */
export function pastMonths(days: PastDay[], from: LocalDate | null): PastMonth[] {
  const months = new Map<string, PastMonth>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    let month = months.get(key);
    if (!month) {
      const cut = from !== null && from.slice(0, 7) === key && from.slice(8) !== "01" ? from : null;
      months.set(key, (month = { key, days: [], from: cut, doses: 0, injections: 0, weights: 0, labs: 0 }));
    }
    month.days.push(day);
    for (const r of day.records) {
      if (r.kind === "dose" || r.kind === "extra") month.doses++;
      else if (r.kind === "injection") month.injections++;
      else if (r.kind === "weight") month.weights++;
      else if (r.kind === "lab") month.labs++;
    }
  }
  return [...months.values()];
}

/** "17 days · 34 doses ticked · 1 weight", with "from 18 Sep" first when the month is cut. */
export function monthMeta(month: PastMonth): string {
  const n = (count: number, one: string, many: string) => (count > 0 ? `${count} ${count === 1 ? one : many}` : null);
  return [
    month.from && `from ${dayMonth(month.from)}`,
    `${month.days.length} ${month.days.length === 1 ? "day" : "days"}`,
    n(month.doses, "dose ticked", "doses ticked"),
    n(month.injections, "injection", "injections"),
    n(month.weights, "weight", "weights"),
    n(month.labs, "lab report", "lab reports"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Only the records under one filter; days left with nothing drop out. */
export function filterDays(days: PastDay[], group: RecordGroup | null): PastDay[] {
  if (!group) return days;
  return days.map((d) => ({ ...d, records: d.records.filter((r) => r.group === group) })).filter((d) => d.records.length > 0);
}
