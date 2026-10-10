import { z } from "zod";
import { type LocalDate, isLocalDate } from "@/engine/time";
import type { ConditionPack } from "@/packs/schema";

/**
 * A lab result as the owner copies it from their lab report: each value and
 * the range printed beside it. Tailhelm compares a value only with the range
 * on the owner's own report; it has no ranges of its own.
 */

export type FieldErrors = Record<string, string>;

export type ResultField = { key: string; label: string; unit: string };
export type ResultType = { key: string; name: string; fields: ResultField[] };
export type Range = { low: number; high: number };

export type ResultInput = {
  type_key: string;
  taken_on: LocalDate;
  values: Record<string, number>;
  /** Only the ranges the owner entered. */
  ranges: Record<string, Range>;
  note: string | null;
};

/** The pack's observation types that are lab results: every field has a unit. */
export function resultTypes(pack: ConditionPack | null): ResultType[] {
  return (pack?.observationTypes ?? [])
    .filter((t) => t.fields.every((f) => f.unit))
    .map((t) => ({ key: t.key, name: t.name, fields: t.fields.map((f) => ({ key: f.key, label: f.label, unit: f.unit! })) }));
}

const NUMBER = /^\d{1,4}(\.\d{1,3})?$/;
const num = (raw: FormDataEntryValue | null) => String(raw ?? "").trim();

export function parseResultForm(
  form: FormData,
  type: ResultType,
  today: LocalDate,
): { ok: true; value: ResultInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const takenOn = String(form.get("taken_on") ?? "").trim();
  if (!isLocalDate(takenOn) || takenOn > today) errors.taken_on = "Enter the date the blood was taken, today or earlier.";

  const values: Record<string, number> = {};
  const ranges: Record<string, Range> = {};
  for (const f of type.fields) {
    const raw = num(form.get(f.key));
    if (!NUMBER.test(raw) || Number(raw) <= 0) errors[f.key] = `Enter the ${f.label.toLowerCase()} from the lab report, as a number.`;
    else values[f.key] = Number(raw);

    const low = num(form.get(`${f.key}_low`));
    const high = num(form.get(`${f.key}_high`));
    if (low === "" && high === "") continue;
    if (!NUMBER.test(low) || !NUMBER.test(high) || !(Number(low) < Number(high))) {
      errors[`${f.key}_range`] = "Enter both ends of the range printed on the lab report, lowest first, or leave both blank.";
    } else {
      ranges[f.key] = { low: Number(low), high: Number(high) };
    }
  }

  const note = z.string().trim().max(500).safeParse(form.get("note") ?? "");
  if (!note.success) errors.note = "Use 500 characters or fewer.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { type_key: type.key, taken_on: takenOn, values, ranges, note: note.success && note.data !== "" ? note.data : null },
  };
}

export type Derived = { key: string; name: string; value: number };
export type DerivedDef = Pick<ConditionPack["derivedValues"][number], "key" | "name" | "operation" | "numerator" | "denominator">;

/** The pack's derived values for one result type, small enough to send to the form. */
export function derivedDefs(pack: ConditionPack | null, typeKey: string): DerivedDef[] {
  return (pack?.derivedValues ?? [])
    .filter((d) => d.observationType === typeKey)
    .map(({ key, name, operation, numerator, denominator }) => ({ key, name, operation, numerator, denominator }));
}

/** Each derived value, e.g. Na:K ratio = sodium ÷ potassium, to one decimal place. */
export function deriveFrom(defs: DerivedDef[], values: Record<string, number>): Derived[] {
  return defs.flatMap((d) => {
    const a = values[d.numerator];
    const b = values[d.denominator];
    if (a === undefined || b === undefined) return [];
    const raw = d.operation === "ratio" ? (b === 0 ? NaN : a / b) : a - b;
    return Number.isFinite(raw) ? [{ key: d.key, name: d.name, value: Math.round(raw * 10) / 10 }] : [];
  });
}

export function deriveValues(pack: ConditionPack | null, typeKey: string, values: Record<string, number>): Derived[] {
  return deriveFrom(derivedDefs(pack, typeKey), values);
}

/** Against the owner's own lab range only. Null when they entered no range. */
export function rangeStatus(value: number, range: Range | undefined): "inside" | "outside" | null {
  if (!range) return null;
  return value >= range.low && value <= range.high ? "inside" : "outside";
}

const fmt = (n: number) => String(Number(n.toFixed(3)));

/** One field as the owner reads it: "Potassium 5.6 mmol/L, outside the range on your lab report (3.6 to 5.5), ask your vet." */
export function describeValue(field: ResultField, value: number, range: Range | undefined): string {
  const base = `${field.label} ${fmt(value)} ${field.unit}`;
  const status = rangeStatus(value, range);
  if (!status || !range) return `${base}.`;
  const printed = `(${fmt(range.low)} to ${fmt(range.high)})`;
  return status === "inside"
    ? `${base}, inside the range on your lab report ${printed}.`
    : `${base}, outside the range on your lab report ${printed}, ask your vet.`;
}
