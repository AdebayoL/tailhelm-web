import { type LocalDate, toLocal } from "@/engine/time";
import type { PlanSchedule } from "@/engine/schedule";
import { describeSchedule } from "@/lib/plan/input";
import { NOTE_KIND } from "@/lib/notes/input";
import { WEIGHT_TYPE } from "@/lib/weight/input";
import type { ConditionPack } from "@/packs/schema";

/**
 * The full export: everything Tailhelm holds about the owner's dogs, as one
 * CSV with a row per fact, so it opens in any spreadsheet. Doses appear only
 * as the owner typed them from their vet's instructions.
 */

export type ExportDog = {
  id: string;
  name: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_email: string | null;
  out_of_hours_phone: string | null;
  insurance_ref: string | null;
  status: string;
};

export type ExportCondition = {
  id: string;
  dog_id: string;
  condition_key: string;
  /** The condition's name, such as "Addison's disease". */
  name: string;
  pack_version: string;
  variant: string | null;
  diagnosed_on: string | null;
};

export type ExportPlanItem = {
  id: string;
  dog_condition_id: string;
  product: string | null;
  strength: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_json: PlanSchedule;
  set_by_vet_on: string | null;
  vet_instructions: string | null;
  active: boolean;
  /** The plan item this one replaced, when the plan was changed. */
  supersedes_id: string | null;
  created_at: string;
  created_by: string | null;
};

export type ExportTreatment = {
  plan_item_id: string;
  given_at: string;
  given_on: string;
  slot: string;
  extra_no: number;
  amount: number | null;
  unit: string | null;
  given_by_profile: string | null;
  given_by: string | null;
  site: string | null;
  vial_id: string | null;
  note: string | null;
};

export type ExportVial = {
  id: string;
  plan_item_id: string;
  batch: string | null;
  expires_on: string | null;
  opened_on: string | null;
};

export type ExportObservation = {
  dog_condition_id: string;
  type_key: string;
  taken_at: string;
  values_json: Record<string, number | boolean>;
  ranges_json: Record<string, { low: number; high: number }> | null;
  derived_json: Record<string, number> | null;
  cycle_no: number | null;
  days_since_anchor: number | null;
  note: string | null;
  recorded_by: string | null;
  /** Weights only: the clinic's scale or a home one. */
  scale: "clinic" | "home" | null;
};

export type ExportEvent = {
  dog_id: string;
  kind: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  recorded_by: string | null;
};

export type ExportData = {
  dogs: ExportDog[];
  conditions: ExportCondition[];
  planItems: ExportPlanItem[];
  treatments: ExportTreatment[];
  vials: ExportVial[];
  observations: ExportObservation[];
  events: ExportEvent[];
  /** Household members' names by profile id. */
  names: Record<string, string>;
};

export const HEADER = ["Dog", "Record", "Date", "Time", "Item", "Value", "Unit", "Details", "Recorded by"] as const;

type Row = [dog: string, record: string, date: string, time: string, item: string, value: string, unit: string, details: string, by: string];

/**
 * One CSV cell. Text that a spreadsheet would run as a formula is prefixed
 * with an apostrophe, so an exported note can never execute.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n)));
const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join("; ");

export function buildExportCsv(
  data: ExportData,
  timeZone: string,
  packFor: (conditionKey: string) => ConditionPack | null,
): string {
  const rows: Row[] = [];
  const who = (id: string | null) => (id ? (data.names[id] ?? "") : "");
  const local = (at: string) => toLocal(new Date(at), timeZone);
  const dogName = new Map(data.dogs.map((d) => [d.id, d.name]));
  const conditions = new Map(data.conditions.map((c) => [c.id, c]));
  const items = new Map(data.planItems.map((i) => [i.id, i]));
  const vials = new Map(data.vials.map((v) => [v.id, v]));
  const dogOfCondition = (id: string) => dogName.get(conditions.get(id)?.dog_id ?? "") ?? "";
  const dogOfItem = (id: string) => dogOfCondition(items.get(id)?.dog_condition_id ?? "");
  const itemName = (i: ExportPlanItem | undefined) => (i ? [i.product, i.strength].filter(Boolean).join(" ") : "");

  for (const d of data.dogs) {
    const fields: [string, string | null][] = [
      ["Breed", d.breed],
      ["Sex", d.sex],
      ["Date of birth", d.date_of_birth],
      ["Vet", d.vet_name],
      ["Vet phone", d.vet_phone],
      ["Vet email", d.vet_email],
      ["Out-of-hours phone", d.out_of_hours_phone],
      ["Insurance reference", d.insurance_ref],
      ["Status", d.status.replace("_", " ")],
    ];
    for (const [item, value] of fields) if (value) rows.push([d.name, "Dog", "", "", item, value, "", "", ""]);
  }

  for (const c of data.conditions) {
    rows.push([
      dogName.get(c.dog_id) ?? "",
      "Condition",
      c.diagnosed_on ?? "",
      "",
      c.name,
      "",
      "",
      join([c.variant && `Variant: ${c.variant}`, `Guidance version ${c.pack_version}`]),
      "",
    ]);
  }

  for (const i of data.planItems) {
    rows.push([
      dogOfCondition(i.dog_condition_id),
      "Plan",
      i.set_by_vet_on ?? "",
      "",
      itemName(i),
      num(i.dose_amount),
      i.dose_unit ?? "",
      join([
        i.schedule_json.kind !== "event" && describeSchedule(i.schedule_json),
        i.vet_instructions && `Vet's instructions: ${i.vet_instructions}`,
        i.set_by_vet_on && "Date is when the vet set it",
        !i.active && "Replaced",
      ]),
      who(i.created_by),
    ]);
  }

  for (const v of data.vials) {
    rows.push([
      dogOfItem(v.plan_item_id),
      "Vial",
      v.opened_on ?? "",
      "",
      itemName(items.get(v.plan_item_id)),
      "",
      "",
      join([v.batch && `Batch ${v.batch}`, v.opened_on && "Date is when it was opened", v.expires_on && `Expires ${v.expires_on}`]),
      "",
    ]);
  }

  for (const t of data.treatments) {
    const vial = t.vial_id ? vials.get(t.vial_id) : undefined;
    rows.push([
      dogOfItem(t.plan_item_id),
      "Given",
      t.given_on,
      /^\d{2}:\d{2}$/.test(t.slot) ? t.slot : local(t.given_at).time,
      itemName(items.get(t.plan_item_id)),
      num(t.amount),
      t.unit ?? "",
      join([
        t.extra_no > 0 && `Extra dose ${t.extra_no}`,
        t.site && `Site: ${t.site}`,
        vial?.batch && `Vial batch ${vial.batch}`,
        t.note,
      ]),
      t.given_by ?? who(t.given_by_profile),
    ]);
  }

  for (const o of data.observations) {
    const condition = conditions.get(o.dog_condition_id);
    const pack = condition ? packFor(condition.condition_key) : null;
    const type = pack?.observationTypes.find((t) => t.key === o.type_key);
    const { date, time } = local(o.taken_at);
    const dog = dogOfCondition(o.dog_condition_id);
    const by = who(o.recorded_by);
    const cycle = o.cycle_no !== null && o.days_since_anchor !== null && `Day ${o.days_since_anchor} after injection ${o.cycle_no}`;

    if (o.type_key === WEIGHT_TYPE) {
      rows.push([dog, "Weight", date, time, "Weight", num(o.values_json.kg as number), "kg", o.note ?? "", by]);
      continue;
    }
    if (type && type.fields.every((f) => !f.unit)) {
      const noticed = type.fields.filter((f) => o.values_json[f.key]).map((f) => f.label);
      rows.push([dog, type.name, date, time, "Signs noticed", noticed.length ? noticed.join(", ") : "None", "", o.note ?? "", by]);
      continue;
    }
    for (const [key, value] of Object.entries(o.values_json)) {
      const field = type?.fields.find((f) => f.key === key);
      const range = o.ranges_json?.[key];
      rows.push([
        dog,
        type?.name ?? o.type_key,
        date,
        time,
        field?.label ?? key,
        num(value as number),
        field?.unit ?? "",
        join([range && `Lab report range ${range.low} to ${range.high}`, cycle, o.note]),
        by,
      ]);
    }
    for (const [key, value] of Object.entries(o.derived_json ?? {})) {
      const def = pack?.derivedValues.find((d) => d.key === key);
      rows.push([dog, type?.name ?? o.type_key, date, time, def?.name ?? key, num(Math.round(value * 10) / 10), "", join([cycle]), by]);
    }
  }

  for (const e of data.events) {
    const start = local(e.started_at).date;
    const end = e.ended_at ? local(e.ended_at).date : null;
    const isNote = e.kind === NOTE_KIND;
    const pack = data.conditions.find((c) => c.dog_id === e.dog_id);
    const label = isNote
      ? "Note"
      : ((pack && packFor(pack.condition_key)?.events.find((x) => x.key === e.kind)?.name) ?? e.kind.replace(/_/g, " "));
    rows.push([
      dogName.get(e.dog_id) ?? "",
      label,
      start,
      isNote ? local(e.started_at).time : "",
      isNote ? "" : (e.note ?? ""),
      "",
      "",
      isNote ? (e.note ?? "") : end && end !== start ? `Until ${end}` : "",
      who(e.recorded_by),
    ]);
  }

  // Each dog's records together, then oldest first within a kind of record.
  const order = new Map(data.dogs.map((d, i) => [d.name, i]));
  const kinds = ["Dog", "Condition", "Plan", "Vial", "Given"];
  const kindRank = (r: string) => (kinds.includes(r) ? kinds.indexOf(r) : kinds.length);
  rows.sort(
    (a, b) =>
      (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0) ||
      kindRank(a[1]) - kindRank(b[1]) ||
      `${a[2]} ${a[3]}`.localeCompare(`${b[2]} ${b[3]}`),
  );

  const lines = [HEADER as readonly string[], ...rows].map((r) => r.map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** The file name, e.g. "tailhelm-export-2026-10-11.csv". */
export function exportFileName(today: LocalDate): string {
  return `tailhelm-export-${today}.csv`;
}
