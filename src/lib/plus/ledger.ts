import { type LocalDate, daysBetween, toLocal } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { tileLetters } from "@/lib/app/jewel";
import type { ExportData } from "@/lib/export/csv";
import { NOTE_KIND } from "@/lib/notes/input";
import { resultTypes } from "@/lib/results/input";
import { signsType } from "@/lib/signs/signs";
import { STRESS_EVENT_KIND } from "@/lib/today/past";
import { WEIGHT_TYPE } from "@/lib/weight/input";
import type { ConditionPack } from "@/packs/schema";

/**
 * The month the household kept, as the day-31 sheet shows it: how many of
 * each record there are, and who made them. Only what was recorded; a row
 * with nothing in it is left out, and nothing is compared with what the plan
 * expected.
 */

/** The tint of a person's initial: indigo for whoever recorded most, ocean next, then mineral. */
export type Tone = "a" | "s" | "m";
export type LedgerPerson = { id: string; name: string; initial: string; tone: Tone };

export type LedgerMark = "pred" | "zyc" | "meas" | "chk" | "note";

export type LedgerRow = {
  key: string;
  mark: LedgerMark;
  /** Two letters for a medicine, such as "Pr"; otherwise the mark draws an icon. */
  tile: string | null;
  count: number;
  label: string;
  sub: string;
  /** The household members who made these records, most first. */
  who: LedgerPerson[];
  /** The row read aloud as one sentence. */
  sentence: string;
};

export type Ledger = { from: LocalDate; to: LocalDate; days: number; rows: LedgerRow[]; total: number };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Adebayo 31, Sam 27": each person and their count, most first. */
function tally(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** "22 Sep", "22 Sep and 20 Oct", "1 Oct, 8 Oct and 15 Oct". */
function dateList(dates: LocalDate[]): string {
  const days = [...new Set(dates)].sort().map(dayMonth);
  return days.length <= 1 ? (days[0] ?? "") : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
}

export function buildLedger({
  data,
  dogId,
  from,
  to,
  timeZone,
  packFor,
}: {
  data: ExportData;
  dogId: string;
  from: LocalDate;
  to: LocalDate;
  timeZone: string;
  packFor: (key: string) => ConditionPack | null;
}): Ledger {
  const dateOf = (at: string) => toLocal(new Date(at), timeZone).date;
  const inPeriod = (date: LocalDate) => date >= from && date <= to;
  const nameOf = (profile: string | null) => (profile && data.names[profile]) || "Someone in the household";

  const conditions = data.conditions.filter((c) => c.dog_id === dogId);
  const conditionIds = new Set(conditions.map((c) => c.id));
  const items = new Map(data.planItems.filter((i) => conditionIds.has(i.dog_condition_id)).map((i) => [i.id, i]));
  const packs = conditions.map((c) => packFor(c.condition_key));
  const signsKeys = new Set(packs.map((p) => signsType(p)?.key).filter(Boolean));
  const labTypes = new Map(packs.flatMap((p) => resultTypes(p)).map((t) => [t.key, t]));

  // Each row keeps who made its records, by profile, so the initials can be shared across rows.
  type Draft = Omit<LedgerRow, "who" | "sub" | "sentence"> & {
    by: Map<string, number>;
    sub: (people: string) => string;
    sentence: (people: string) => string;
  };
  const drafts: Draft[] = [];
  const count = (by: Map<string, number>, key: string | null) => {
    const k = key ?? "";
    by.set(k, (by.get(k) ?? 0) + 1);
  };

  // Daily medicines and injections, one row each, by the name on the plan.
  type Dose = { product: string; date: LocalDate; profile: string | null; givenBy: string | null };
  const daily = new Map<string, Dose[]>();
  const injections = new Map<string, Dose[]>();
  for (const t of data.treatments) {
    const item = items.get(t.plan_item_id);
    if (!item || !inPeriod(t.given_on)) continue;
    const kind = item.schedule_json.kind;
    const into = kind === "fixed" ? daily : kind === "interval" ? injections : null;
    if (!into) continue;
    const product = item.product ?? "Medicine";
    into.set(product, [...(into.get(product) ?? []), { product, date: t.given_on, profile: t.given_by_profile, givenBy: t.given_by }]);
  }
  for (const [product, doses] of daily) {
    const by = new Map<string, number>();
    for (const d of doses) count(by, d.profile);
    drafts.push({
      key: `daily:${product}`,
      mark: "pred",
      tile: tileLetters(product),
      count: doses.length,
      label: plural(doses.length, "Dose ticked", "Doses ticked"),
      by,
      sub: (people) => `${product} · ${people}`,
      sentence: (people) => `${doses.length} ${plural(doses.length, "dose", "doses")} of ${product} ticked: ${people}.`,
    });
  }
  for (const [product, doses] of injections) {
    const by = new Map<string, number>();
    for (const d of doses) count(by, d.profile);
    const one = doses.length === 1 ? doses[0] : null;
    const who = one ? (one.givenBy ?? `by ${nameOf(one.profile)}`) : null;
    const when = one ? `${dayMonth(one.date)} · ${who}` : dateList(doses.map((d) => d.date));
    drafts.push({
      key: `injection:${product}`,
      mark: "zyc",
      tile: tileLetters(product),
      count: doses.length,
      label: `${product} ${plural(doses.length, "injection", "injections")}`,
      by,
      sub: () => when,
      sentence: () => `${doses.length} ${product} ${plural(doses.length, "injection", "injections")}: ${one ? `${dayMonth(one.date)}, ${one.givenBy ?? nameOf(one.profile)}` : when}.`,
    });
  }

  // Checks, weights and lab reports, from the observations.
  const observations = data.observations.filter((o) => conditionIds.has(o.dog_condition_id) && inPeriod(dateOf(o.taken_at)));
  const checks = observations.filter((o) => signsKeys.has(o.type_key));
  if (checks.length > 0) {
    const by = new Map<string, number>();
    for (const c of checks) count(by, c.recorded_by);
    drafts.push({
      key: "checks",
      mark: "chk",
      tile: null,
      count: checks.length,
      label: plural(checks.length, "Quick check", "Quick checks"),
      by,
      sub: (people) => people,
      sentence: (people) => `${checks.length} ${plural(checks.length, "quick check", "quick checks")} saved: ${people}.`,
    });
  }
  const weights = observations.filter((o) => o.type_key === WEIGHT_TYPE);
  if (weights.length > 0) {
    const by = new Map<string, number>();
    const scales = new Map<string, number>();
    for (const w of weights) {
      count(by, w.recorded_by);
      count(scales, w.scale === "clinic" ? "Clinic scale" : w.scale === "home" ? "Home scale" : "Scale not recorded");
    }
    const scaleText = tally(scales)
      .map(([s, n], i) => `${i === 0 ? s : s.toLowerCase()} ${n}`)
      .join(", ");
    drafts.push({
      key: "weights",
      mark: "meas",
      tile: null,
      count: weights.length,
      label: plural(weights.length, "Weight", "Weights"),
      by,
      sub: () => scaleText,
      sentence: () => `${weights.length} ${plural(weights.length, "weight", "weights")}: ${scaleText}.`,
    });
  }
  const labs = observations.filter((o) => labTypes.has(o.type_key));
  if (labs.length > 0) {
    const by = new Map<string, number>();
    for (const l of labs) count(by, l.recorded_by);
    const one = labs.length === 1 ? labs[0] : null;
    const when = one ? `${dayMonth(dateOf(one.taken_at))} · typed in by ${nameOf(one.recorded_by)}` : dateList(labs.map((l) => dateOf(l.taken_at)));
    drafts.push({
      key: "labs",
      mark: "meas",
      tile: null,
      count: labs.length,
      label: plural(labs.length, "Lab report", "Lab reports"),
      by,
      sub: () => when,
      sentence: () => `${labs.length} ${plural(labs.length, "lab report", "lab reports")}: ${when.replace(" · ", ", ")}.`,
    });
  }

  // Notes and stressful days, from the events.
  const events = data.events.filter((e) => e.dog_id === dogId && inPeriod(dateOf(e.started_at)));
  for (const [kind, key, one, many] of [
    [NOTE_KIND, "notes", "Note", "Notes"],
    [STRESS_EVENT_KIND, "stress", "Stressful day", "Stressful days"],
  ] as const) {
    const rows = events.filter((e) => e.kind === kind);
    if (rows.length === 0) continue;
    const by = new Map<string, number>();
    for (const e of rows) count(by, e.recorded_by);
    drafts.push({
      key,
      mark: "note",
      tile: null,
      count: rows.length,
      label: plural(rows.length, one, many),
      by,
      sub: (people) => people,
      sentence: (people) => `${rows.length} ${plural(rows.length, one, many).toLowerCase()}: ${people}.`,
    });
  }

  // The household's initials, tinted by who recorded most across the month.
  const totals = new Map<string, number>();
  for (const d of drafts) for (const [k, n] of d.by) if (k) totals.set(k, (totals.get(k) ?? 0) + n);
  const tones: Tone[] = ["a", "s"];
  const people = new Map<string, LedgerPerson>(
    tally(totals).map(([id], i) => {
      const name = nameOf(id);
      return [id, { id, name, initial: name.charAt(0).toUpperCase(), tone: tones[i] ?? "m" }];
    }),
  );

  const rows = drafts.map(({ by, sub, sentence, ...row }) => {
    const ranked = tally(by);
    const names = ranked.map(([k, n]) => `${k ? nameOf(k) : "Someone in the household"} ${n}`).join(", ");
    return {
      ...row,
      sub: sub(names),
      sentence: sentence(names),
      who: ranked.flatMap(([k]) => (k && people.get(k) ? [people.get(k)!] : [])),
    };
  });

  return { from, to, days: daysBetween(from, to) + 1, rows, total: rows.reduce((n, r) => n + r.count, 0) };
}
