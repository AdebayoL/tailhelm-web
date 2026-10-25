import { type LocalDate, addDays, toLocal } from "@/engine/time";
import { HAPPENING_KIND, happeningLabel } from "@/lib/happening/timer";
import { derivedDefs, resultTypes } from "@/lib/results/input";
import { signsType } from "@/lib/signs/signs";
import { STRESS_EVENT_KIND } from "@/lib/today/past";
import type { ConditionPack } from "@/packs/schema";
import type { DayRecord, NoticedInput, SignRecord, ValueRecord } from "./rules";

export type NoticedObservationRow = {
  id: string;
  type_key: string;
  taken_at: string;
  values_json: Record<string, number | boolean>;
  derived_json: Record<string, number> | null;
};
export type NoticedEventRow = { id: string; kind: string; note: string | null; started_at: string; ended_at: string | null };
export type NoticedAnchorRow = { anchored_on: string; cycle_no: number };

/** A stressful event longer than this still counts only its first days, so one left open never covers months. */
const MAX_STRESS_DAYS = 31;

/** The observation types Noticed reads for a condition: its lab results and its quick check. */
export function noticedTypeKeys(pack: ConditionPack | null): string[] {
  const signs = signsType(pack);
  return [...resultTypes(pack).map((t) => t.key), ...(signs ? [signs.key] : [])];
}

/**
 * One condition's records as the rules read them, every date on the owner's
 * clock. Lab values are the pack's own fields and worked-out values; signs are
 * the pack's quick-check signs, so nothing outside the pack is ever watched.
 */
export function noticedInput(args: {
  dogName: string;
  pack: ConditionPack | null;
  timeZone: string;
  today: LocalDate;
  from: LocalDate | null;
  observations: NoticedObservationRow[];
  events: NoticedEventRow[];
  anchors: NoticedAnchorRow[];
}): NoticedInput {
  const { pack, timeZone } = args;
  const on = (at: string) => toLocal(new Date(at), timeZone).date;
  const values: ValueRecord[] = [];
  const signs: SignRecord[] = [];
  const checks: DayRecord[] = [];

  const results = new Map(resultTypes(pack).map((t) => [t.key, t]));
  const signsOf = signsType(pack);
  for (const o of args.observations) {
    const date = on(o.taken_at);
    const result = results.get(o.type_key);
    if (result) {
      for (const f of result.fields) {
        const value = o.values_json[f.key];
        if (typeof value === "number") values.push({ id: o.id, on: date, key: f.key, label: f.label, unit: f.unit, value, derived: false });
      }
      for (const d of derivedDefs(pack, o.type_key)) {
        const value = o.derived_json?.[d.key];
        if (typeof value === "number") values.push({ id: o.id, on: date, key: d.key, label: d.name, unit: null, value, derived: true });
      }
    } else if (signsOf && o.type_key === signsOf.key) {
      checks.push({ id: o.id, on: date, text: "Quick check" });
      for (const s of signsOf.signs) if (o.values_json[s.key] === true) signs.push({ id: o.id, on: date, key: s.key, label: s.label });
    }
  }

  const happenings: DayRecord[] = [];
  const stress: DayRecord[] = [];
  for (const e of args.events) {
    const start = on(e.started_at);
    if (e.kind === HAPPENING_KIND) happenings.push({ id: e.id, on: start, text: happeningLabel(e) });
    if (e.kind === STRESS_EVENT_KIND) {
      const end = e.ended_at ? on(e.ended_at) : start;
      const title = e.note?.trim() || "Stressful day";
      for (let d = start, n = 0; d <= end && n < MAX_STRESS_DAYS; d = addDays(d, 1), n++) stress.push({ id: e.id, on: d, text: title });
    }
  }

  return {
    dogName: args.dogName,
    today: args.today,
    from: args.from,
    values,
    signs,
    checks,
    happenings,
    stress,
    anchors: args.anchors.map((a) => ({ on: a.anchored_on, cycleNo: a.cycle_no })),
  };
}
