import type { ConditionPack } from "@/packs/schema";
import { type Range, type ResultType, derivedDefs } from "./input";

/** One line of a lab report: a result as typed in, or a value Tailhelm worked out from them. */
export type LabRow = { key: string; label: string; value: string; unit: string | null; range: Range | null };

type Report = {
  values_json: Record<string, number>;
  ranges_json: Record<string, Range> | null;
  derived_json: Record<string, number> | null;
};

/** A lab report's rows: each result as typed in, then the values Tailhelm worked out from them. */
export function labRows(type: ResultType, report: Report, pack: ConditionPack | null): LabRow[] {
  const fields: LabRow[] = type.fields
    .filter((f) => report.values_json[f.key] !== undefined)
    .map((f) => ({
      key: f.key,
      label: f.label,
      value: String(Number(report.values_json[f.key].toFixed(3))),
      unit: f.unit,
      range: report.ranges_json?.[f.key] ?? null,
    }));
  const derived: LabRow[] = derivedDefs(pack, type.key)
    .filter((d) => report.derived_json?.[d.key] !== undefined)
    .map((d) => ({ key: d.key, label: d.name, value: report.derived_json![d.key].toFixed(1), unit: null, range: null }));
  return [...fields, ...derived];
}

const num = (n: number) => String(Number(n.toFixed(3)));

export function rangeText(range: Range): string {
  return `${num(range.low)}–${num(range.high)}`;
}

/** Inside or outside the range printed on the owner's own lab report; never a judgement of the number. */
export function readingText(row: LabRow): string {
  if (!row.range) return "no range given on the lab report";
  const v = Number(row.value);
  return v >= row.range.low && v <= row.range.high ? "inside the range on the lab report" : "outside the range on the lab report";
}
