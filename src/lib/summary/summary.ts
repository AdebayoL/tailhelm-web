import { type LocalDate, addDays, daysBetween, toLocal } from "@/engine/time";
import { monthYear, weekdayDate } from "@/lib/app/dates";
import type { ExportData, ExportObservation, ExportPlanItem, ExportTreatment } from "@/lib/export/csv";
import { NOTE_KIND } from "@/lib/notes/input";
import { describePlanItem, describeSchedule, doseText, formatDate } from "@/lib/plan/input";
import { resultTypes } from "@/lib/results/input";
import { labRows, rangeText, readingText } from "@/lib/results/rows";
import { signsType } from "@/lib/signs/signs";
import { STRESS_EVENT_KIND } from "@/lib/today/past";
import { WEIGHT_TYPE, kgFigure } from "@/lib/weight/input";
import { conditionMedicalName } from "@/packs/names";
import type { ConditionPack } from "@/packs/schema";
import type { Block, PdfInput, Run } from "./pdf";

/**
 * The plain 90-day summary: free on every plan, so no owner is ever unable to
 * show their vet something. It states what the household recorded, with
 * dates and who entered it, and nothing else: no reading of the numbers
 * beyond where each sits against the range printed on the owner's own lab
 * report, and doses only as the owner typed them from the vet's instructions.
 */

export const SUMMARY_DAYS = 90;

const KIND_ORDER = { fixed: 0, interval: 1, offset: 2, series: 3, event: 4 } as const;
const SCALE = { clinic: "clinic scale", home: "home scale" } as const;

type Args = {
  data: ExportData;
  dogId: string;
  timeZone: string;
  now: Date;
  packFor: (conditionKey: string) => ConditionPack | null;
};

const line = (runs: Run[], opts: { indent?: boolean; muted?: boolean; gap?: boolean } = {}): Block => ({ kind: "line", runs, ...opts });
const lead = (label: string, text: string, opts?: { indent?: boolean; muted?: boolean; gap?: boolean }): Block =>
  line([{ text: `${label} `, bold: true }, { text }], opts);
const plain = (text: string, opts?: { indent?: boolean; muted?: boolean; gap?: boolean }): Block => line([{ text }], opts);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const itemName = (i: ExportPlanItem) => [i.product, i.strength].filter(Boolean).join(" ") || "Plan item";
const amount = (t: ExportTreatment) => (t.amount !== null && t.unit ? `${String(Number(Number(t.amount).toFixed(3)))} ${t.unit}` : null);
const joinList = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/** The summary as blocks for the PDF, or null when the dog is not the signed-in person's. */
export function buildSummary({ data, dogId, timeZone, now, packFor }: Args): PdfInput | null {
  const dog = data.dogs.find((d) => d.id === dogId);
  if (!dog) return null;
  const local = (at: string) => toLocal(new Date(at), timeZone);
  const here = toLocal(now, timeZone);
  const today = here.date;
  const from = addDays(today, -(SUMMARY_DAYS - 1));
  const inWindow = (date: LocalDate) => date >= from && date <= today;
  const who = (id: string | null) => (id && data.names[id]) || "someone in the household";

  const conditions = data.conditions.filter((c) => c.dog_id === dogId);
  const conditionIds = new Set(conditions.map((c) => c.id));
  const items = data.planItems
    .filter((i) => conditionIds.has(i.dog_condition_id))
    .sort((a, b) => KIND_ORDER[a.schedule_json.kind] - KIND_ORDER[b.schedule_json.kind] || a.created_at.localeCompare(b.created_at));
  const byId = new Map(items.map((i) => [i.id, i]));
  const vials = new Map(data.vials.map((v) => [v.id, v]));
  const treatments = data.treatments
    .filter((t) => byId.has(t.plan_item_id) && inWindow(t.given_on))
    .sort((a, b) => b.given_at.localeCompare(a.given_at));
  const observations = data.observations
    .filter((o) => conditionIds.has(o.dog_condition_id) && inWindow(local(o.taken_at).date))
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at));
  const events = data.events
    .filter((e) => {
      if (e.dog_id !== dogId) return false;
      const start = local(e.started_at).date;
      const end = e.ended_at ? local(e.ended_at).date : start;
      return start <= today && end >= from;
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  const blocks: Block[] = [{ kind: "title", text: `${dog.name}: 90-day summary` }];
  blocks.push(plain(`${formatDate(from)} to ${formatDate(today)}. Prepared ${weekdayDate(today)}, ${here.time}.`, { muted: true }));
  const facts = [dog.breed, dog.sex, dog.date_of_birth && `born ${monthYear(dog.date_of_birth)}`].filter(Boolean).join(" · ");
  if (facts) blocks.push(plain(facts));
  for (const c of conditions) {
    const medical = conditionMedicalName(c.condition_key);
    const parts = [
      `${c.name}${medical ? ` (${medical})` : ""}`,
      c.variant,
      c.diagnosed_on ? `diagnosed ${formatDate(c.diagnosed_on)}` : "diagnosis date not entered",
    ].filter(Boolean);
    blocks.push(lead("Condition:", parts.join(", ")));
  }
  const vet = [dog.vet_name, dog.vet_phone].filter(Boolean).join(", ");
  if (vet) blocks.push(lead("Usual vet:", vet));
  if (dog.out_of_hours_phone) blocks.push(lead("Out-of-hours vet:", dog.out_of_hours_phone));

  // The plan as it stands, exactly as the owner typed it from the vet's instructions.
  blocks.push({ kind: "heading", text: "Plan, as the vet set it" });
  const active = items.filter((i) => i.active);
  if (active.length === 0) blocks.push(plain("Nothing is on the plan."));
  for (const i of active) {
    const dose = doseText(i);
    const what =
      i.schedule_json.kind === "event"
        ? [`on stressful days`, i.vet_instructions].filter(Boolean).join(": ")
        : [dose, describeSchedule(i.schedule_json)].filter(Boolean).join(", ");
    const set = i.set_by_vet_on ? `Set by the vet on ${formatDate(i.set_by_vet_on)}.` : "Date set by the vet not entered.";
    blocks.push(lead(`${itemName(i)}:`, `${what}. ${set}`, { gap: true }));
    if (i.vet_instructions && i.schedule_json.kind !== "event") blocks.push(plain(`Vet's instructions: ${i.vet_instructions}`, { indent: true }));
    blocks.push(plain(`Entered by ${who(i.created_by)} on ${formatDate(local(i.created_at).date)}.`, { indent: true, muted: true }));
  }

  const changes = items.filter((i) => i.supersedes_id && byId.has(i.supersedes_id) && inWindow(local(i.created_at).date));
  if (changes.length > 0) {
    blocks.push({ kind: "heading", text: "Plan changes" });
    for (const i of [...changes].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const was = byId.get(i.supersedes_id!)!;
      blocks.push(lead(`${formatDate(local(i.created_at).date)}:`, `now ${describePlanItem(i)}.`, { gap: true }));
      blocks.push(plain(`Before: ${describePlanItem(was)}.`, { indent: true }));
      blocks.push(plain(`Changed by ${who(i.created_by)}.`, { indent: true, muted: true }));
    }
  }

  const ticksOf = (i: ExportPlanItem) => treatments.filter((t) => t.plan_item_id === i.id);
  const givenBy = (t: ExportTreatment) => t.given_by ?? who(t.given_by_profile);

  // What is on the plan now, then anything replaced or taken off that was ticked in the period.
  const current = (a: ExportPlanItem, b: ExportPlanItem) => Number(b.active) - Number(a.active);
  const daily = items.filter((i) => i.schedule_json.kind === "fixed" && (i.active || ticksOf(i).length > 0)).sort(current);
  if (daily.length > 0) {
    blocks.push({ kind: "heading", text: "Daily doses ticked" });
    for (const i of daily) blocks.push(...dailyLines(i, ticksOf(i)));
  }

  const injectionItems = items.filter((i) => i.schedule_json.kind === "interval" && (i.active || ticksOf(i).length > 0)).sort(current);
  if (injectionItems.length > 0) {
    blocks.push({ kind: "heading", text: "Injections" });
    for (const i of injectionItems) {
      const given = ticksOf(i).filter((t) => t.slot === "injection");
      blocks.push(lead(`${itemName(i)}${i.active ? "" : " (no longer on the plan)"}:`, given.length ? `${plural(given.length, "injection")} recorded.` : "None recorded.", { gap: true }));
      for (const t of given) {
        const batch = t.vial_id ? vials.get(t.vial_id)?.batch : null;
        const parts = [amount(t), t.site && `site: ${t.site}`, `given by ${givenBy(t)}`, batch && `vial batch ${batch}`, t.note].filter(Boolean);
        blocks.push(plain(`${formatDate(t.given_on)}: ${parts.join(", ")}`, { indent: true }));
      }
    }
  }

  function dailyLines(i: ExportPlanItem, ticks: ExportTreatment[]): Block[] {
    const out: Block[] = [];
    const times = i.schedule_json.kind === "fixed" ? [...new Set(i.schedule_json.times)] : [];
    const regular = ticks.filter((t) => t.extra_no === 0);
    const extras = ticks.filter((t) => t.extra_no > 0);
    const name = `${itemName(i)}${i.active ? "" : " (no longer on the plan)"}:`;
    const days = new Set(regular.map((t) => t.given_on));
    out.push(lead(name, `${plural(regular.length, "tick")} on ${plural(days.size, "day")}.`, { gap: true }));

    // Whole days only: the day the item was added and today are still partly open.
    if (i.active && times.length > 0) {
      const added = local(i.created_at).date;
      const first = added >= from ? addDays(added, 1) : from;
      const last = addDays(today, -1);
      if (first <= last) {
        const count = daysBetween(first, last) + 1;
        const short: string[] = [];
        for (let d = first; d <= last; d = addDays(d, 1)) {
          const n = regular.filter((t) => t.given_on === d && times.includes(t.slot)).length;
          if (n < times.length) short.push(times.length === 1 ? formatDate(d) : `${formatDate(d)} (${n} of ${times.length})`);
        }
        const span = `${formatDate(first)} to ${formatDate(last)}`;
        const one = times.length === 1;
        out.push(
          plain(
            short.length === 0
              ? `${span}: ${one ? "a tick" : `all ${times.length} ticks`} on each of the ${plural(count, "day")}.`
              : `${span}: ${one ? "no tick" : `fewer than ${times.length} ticks`} on ${short.length} of the ${plural(count, "day")}: ${joinList(short)}.`,
            { indent: true },
          ),
        );
      }
    }
    for (const t of extras) {
      const parts = [amount(t), `ticked by ${givenBy(t)}`, t.note].filter(Boolean);
      out.push(plain(`Extra dose ${formatDate(t.given_on)}, ${local(t.given_at).time}: ${parts.join(", ")}`, { indent: true }));
    }
    return out;
  }

  // Lab results and weights, latest first, each with where it came from.
  const packs = new Map(conditions.map((c) => [c.id, packFor(c.condition_key)]));
  const labTypes = conditions.flatMap((c) => resultTypes(packs.get(c.id) ?? null).map((type) => ({ type, condition: c.id })));
  blocks.push({ kind: "heading", text: "Lab results" });
  const labs = observations.filter((o) => labTypes.some((l) => l.condition === o.dog_condition_id && l.type.key === o.type_key));
  if (labs.length === 0) blocks.push(plain("No lab reports entered."));
  for (const o of labs) {
    const { type } = labTypes.find((l) => l.condition === o.dog_condition_id && l.type.key === o.type_key)!;
    const cycle = o.cycle_no !== null && o.days_since_anchor !== null ? `Day ${o.days_since_anchor} after injection ${o.cycle_no}.` : "";
    blocks.push(lead(`${type.name}, ${formatDate(local(o.taken_at).date)}.`, cycle, { gap: true }));
    for (const row of labRows(type, o as ExportObservation & { values_json: Record<string, number> }, packs.get(o.dog_condition_id) ?? null)) {
      const range = row.range ? ` (${rangeText(row.range)})` : "";
      const reading = row.unit === null && !row.range ? "" : `: ${readingText(row)}${range}`;
      blocks.push(plain(`${row.label} ${row.value}${row.unit ? ` ${row.unit}` : ""}${reading}`, { indent: true }));
    }
    if (o.note) blocks.push(plain(`Note: ${o.note}`, { indent: true }));
    blocks.push(plain(`Typed in by ${who(o.recorded_by)} from the printed report.`, { indent: true, muted: true }));
  }

  blocks.push({ kind: "heading", text: "Weight" });
  const weights = observations.filter((o) => o.type_key === WEIGHT_TYPE);
  if (weights.length === 0) blocks.push(plain("No weights entered."));
  for (const w of weights) {
    const parts = [
      `${kgFigure(Number(w.values_json.kg))} kg`,
      w.scale ? SCALE[w.scale] : "scale not recorded",
      `entered by ${who(w.recorded_by)}`,
      w.note,
    ].filter(Boolean);
    blocks.push(lead(`${formatDate(local(w.taken_at).date)}:`, parts.join(", ")));
  }

  for (const c of conditions) {
    const signs = signsType(packs.get(c.id) ?? null);
    if (!signs) continue;
    blocks.push({ kind: "heading", text: "Signs ticked on the quick check" });
    const checks = observations.filter((o) => o.dog_condition_id === c.id && o.type_key === signs.key);
    const byDay = new Map<LocalDate, Set<string>>();
    for (const o of checks) {
      const day = local(o.taken_at).date;
      const ticked = byDay.get(day) ?? new Set<string>();
      for (const s of signs.signs) if (o.values_json[s.key] === true) ticked.add(s.key);
      byDay.set(day, ticked);
    }
    if (byDay.size === 0) {
      blocks.push(plain("No checks saved."));
      continue;
    }
    const withSigns = [...byDay].filter(([, ticked]) => ticked.size > 0);
    blocks.push(plain(`Checks saved on ${plural(byDay.size, "day")}, with signs ticked on ${withSigns.length} of them.`));
    for (const [day, ticked] of withSigns) {
      const labels = signs.signs.filter((s) => ticked.has(s.key)).map((s) => s.label);
      blocks.push(lead(`${formatDate(day)}:`, labels.join(", "), { indent: true }));
    }
  }

  blocks.push({ kind: "heading", text: "Stressful days and events" });
  const happenings = events.filter((e) => e.kind !== NOTE_KIND);
  if (happenings.length === 0) blocks.push(plain("None recorded."));
  for (const e of happenings) {
    const start = local(e.started_at).date;
    const end = e.ended_at ? local(e.ended_at).date : null;
    const when = end && end !== start ? `${formatDate(start)} to ${formatDate(end)}:` : `${formatDate(start)}:`;
    const pack = conditions.map((c) => packs.get(c.id)).find((p) => p?.events.some((x) => x.key === e.kind));
    const label = e.kind === STRESS_EVENT_KIND ? "Stressful day" : (pack?.events.find((x) => x.key === e.kind)?.name ?? e.kind.replace(/_/g, " "));
    blocks.push(lead(when, [label, e.note].filter(Boolean).join(": ") + `. Entered by ${who(e.recorded_by)}.`));
  }

  blocks.push({ kind: "heading", text: "Notes" });
  const notes = events.filter((e) => e.kind === NOTE_KIND);
  if (notes.length === 0) blocks.push(plain("No notes."));
  for (const n of notes) {
    blocks.push(lead(`${formatDate(local(n.started_at).date)}, ${who(n.recorded_by)}:`, n.note ?? "", { gap: true }));
  }

  blocks.push({ kind: "heading", text: "About this summary" });
  blocks.push(
    plain(
      `Prepared with Tailhelm from what ${dog.name}’s household entered. It is not a clinical record. Doses are exactly as the household typed them from the vet’s instructions; Tailhelm never works one out. A dose given but not ticked shows here as not ticked.`,
    ),
  );

  return {
    title: `${dog.name}: 90-day summary`,
    footer: `${dog.name} · ${formatDate(from)} to ${formatDate(today)} · prepared with Tailhelm`,
    blocks,
  };
}

/** The file name, e.g. "tailhelm-90-day-summary-2026-10-17.pdf". */
export function summaryFileName(today: LocalDate): string {
  return `tailhelm-90-day-summary-${today}.pdf`;
}

/** The summary's text, line by line, for tests and checks of its wording. */
export function summaryText(summary: PdfInput): string {
  return summary.blocks
    .map((b) => (b.kind === "line" ? `${b.indent ? "  " : ""}${b.runs.map((r) => r.text).join("")}` : b.kind === "heading" ? `\n## ${b.text}` : `# ${b.text}`))
    .join("\n");
}
