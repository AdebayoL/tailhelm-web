import { type LocalDate, addDays, daysBetween } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { formatDate } from "@/lib/plan/input";

/**
 * Noticed: what Tailhelm finds in a dog's own records without being asked
 * (Build Spec, "Noticed"). A daily job tests the household's records against
 * six fixed rule families. Every observation is a rule with a threshold and
 * the exact records behind it: it never compares one dog with another, never
 * predicts and never uses a model.
 *
 * None of this is a care rule. It only counts what the household recorded,
 * about the lab values and signs the condition pack already lists with their
 * sources, so the thresholds below are the Build Spec's own. Its words state
 * numbers and dates and nothing else, and never mention a dose. The screens
 * add the one action it ever names: worth mentioning to your vet. Anything
 * meeting an amber or red published rule is an alert elsewhere, never an
 * observation here.
 */

/** The rule families, in the order one is chosen when several find something. */
export const FAMILIES = ["cycle_position", "interval_change", "co_occurrence", "direction", "absence", "plain_record"] as const;
export type Family = (typeof FAMILIES)[number];

export const THRESHOLDS = {
  /** Cycle position: the same point in this many injection cycles (spec: 3 cycles). */
  cycles: 3,
  /** "The same point": cycle days no more than this many days apart, so within 5 days. */
  sameSpan: 4,
  /** Interval change: times logged (spec: 4 events). */
  events: 4,
  /** The latest gap is half or less, or twice or more, the usual gap before it. */
  intervalFactor: 2,
  /** ...only when the usual gap is at least this many days. */
  minUsualGap: 4,
  /** ...and the latest time was in the last this many days. */
  intervalRecent: 30,
  /** Co-occurrence: days of quick checks needed (spec: 30 days). */
  coDays: 30,
  /** 3 of the last 4 times a sign was logged. */
  coOf: 4,
  coMatch: 3,
  /** On a stressful day or up to this many days after one. */
  afterStress: 2,
  /** Direction: results in a row (spec: 3 results). */
  results: 3,
  /** Absence: days of quick checks needed (spec: 90 days). */
  absenceDays: 90,
  /** Logged at least this many times... */
  absenceTimes: 4,
  /** ...then not for 3 times its usual gap, and at least 30 days. */
  absenceFactor: 3,
  absenceMinDays: 30,
  /** Plain record: the longest time without a sign logged, once it is at least this long... */
  plainMinGap: 14,
  /** ...and the quick checks go back this many days. */
  plainDays: 60,
  /** Absence and plain record count only while quick checks are still saved: this many since, the latest within a week. */
  checksSince: 4,
  lastCheckWithin: 7,
  /** At most one observation per dog in this many days (spec: one a week). */
  everyDays: 7,
} as const;

/** A number from a lab report, as typed in or as Tailhelm worked it out (`derived`). */
export type ValueRecord = {
  id: string;
  on: LocalDate;
  key: string;
  label: string;
  unit: string | null;
  value: number;
  derived: boolean;
};

/** A sign ticked on a day's quick check. */
export type SignRecord = { id: string; on: LocalDate; key: string; label: string };

/** A dated record: a saved quick check, a Happening now record, or one day of a stressful event. */
export type DayRecord = { id: string; on: LocalDate; text: string };

/** An injection that starts a cycle, as the anchors table holds it. */
export type Anchor = { on: LocalDate; cycleNo: number };

export type NoticedInput = {
  dogName: string;
  today: LocalDate;
  /** The first day the account's history reaches: the last 30 days on free, or null for everything on Plus. */
  from: LocalDate | null;
  values: ValueRecord[];
  signs: SignRecord[];
  /** Every day a quick check was saved, with or without a sign. */
  checks: DayRecord[];
  happenings: DayRecord[];
  /** One row for each day a stressful event covers, with its title. */
  stress: DayRecord[];
  anchors: Anchor[];
};

/** A record behind an observation. A run of saved quick checks is one row, with every record's id in `ids`. */
export type Evidence = { id: string; on: LocalDate; text: string; ids?: string[] };

export type Observation = {
  family: Family;
  /** What it is about, such as a lab value's key or a sign's. */
  ruleKey: string;
  /** The finding itself, so the same one is never shown twice. */
  fingerprint: string;
  text: string;
  /** The rule and its threshold in plain words, for "Why am I seeing this?". */
  rule: string;
  windowStart: LocalDate;
  windowEnd: LocalDate;
  /** The exact records it used, oldest first. */
  records: Evidence[];
};

/** Whether a dog is due a new observation: none yet, or the last one is a week old. */
export function dueForNoticed(lastComputedOn: LocalDate | null, today: LocalDate): boolean {
  return lastComputedOn === null || daysBetween(lastComputedOn, today) >= THRESHOLDS.everyDays;
}

/**
 * The one observation to show, if any: the first family in the spec's order
 * that finds something not already shown, and within it the latest finding.
 */
export function chooseNoticed(input: NoticedInput, seen: ReadonlySet<string>): Observation | null {
  for (const family of FAMILIES) {
    const found = FINDERS[family](clean(input)).filter((o) => !seen.has(o.fingerprint));
    if (found.length > 0) return found.sort((a, b) => b.windowEnd.localeCompare(a.windowEnd))[0];
  }
  return null;
}

/** Everything every family finds, for tests and for checking the wording. */
export function allNoticed(input: NoticedInput): Observation[] {
  const c = clean(input);
  return FAMILIES.flatMap((f) => FINDERS[f](c));
}

const FINDERS: Record<Family, (input: NoticedInput) => Observation[]> = {
  cycle_position: (i) => [...valuesByCycle(i), ...signsByCycle(i)],
  interval_change: intervals,
  co_occurrence: (i) => [...withStress(i), ...withCycleDay(i)],
  direction: direction,
  absence: absence,
  plain_record: longestGap,
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Only records inside the account's history and not after today, oldest first. */
function clean(input: NoticedInput): NoticedInput {
  const keep = <T extends { on: LocalDate; id: string }>(rows: T[]) =>
    rows
      .filter((r) => (input.from === null || r.on >= input.from) && r.on <= input.today)
      .sort((a, b) => a.on.localeCompare(b.on) || a.id.localeCompare(b.id));
  return {
    ...input,
    values: keep(input.values),
    signs: keep(input.signs),
    checks: keep(input.checks),
    happenings: keep(input.happenings),
    stress: keep(input.stress),
    anchors: [...input.anchors].sort((a, b) => a.on.localeCompare(b.on)),
  };
}

/** "4 Aug", with the year when it isn't this year's. */
function when(date: LocalDate, today: LocalDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? dayMonth(date) : formatDate(date);
}

function joinList(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** A label inside a sentence: "Potassium" reads "potassium", but "Na:K ratio" stays as it is. */
function inSentence(label: string): string {
  return /^[A-Z][a-z]+(\s|,|$)/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** A sign's name inside a sentence, in quotes because some are phrases: “Less energy than usual”. */
const quoted = (label: string) => `“${label}”`;

/** A value as typed (up to 3 decimals), or a worked-out one to 1 decimal, with its unit. */
function figure(v: ValueRecord): string {
  const n = v.derived ? v.value.toFixed(1) : String(Number(v.value.toFixed(3)));
  return v.unit ? `${n} ${v.unit}` : n;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The injection cycle a day falls in, and how many days after its injection, or null before the first. */
function cycleOf(anchors: Anchor[], date: LocalDate): { cycleNo: number; day: number } | null {
  let found: Anchor | null = null;
  for (const a of anchors) if (a.on <= date) found = a;
  return found && { cycleNo: found.cycleNo, day: daysBetween(found.on, date) };
}

/** Days logged, with days in a row counted as one time, each by the day it began. */
type Episode = { start: LocalDate; end: LocalDate; ids: string[] };

function episodes(rows: { id: string; on: LocalDate }[]): Episode[] {
  const out: Episode[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && (r.on === last.end || r.on === addDays(last.end, 1))) {
      last.end = r.on;
      if (!last.ids.includes(r.id)) last.ids.push(r.id);
    } else out.push({ start: r.on, end: r.on, ids: [r.id] });
  }
  return out;
}

/** The signs logged on each day, one row per day with every sign named. */
function signDays(signs: SignRecord[]): Evidence[] {
  const byDay = new Map<LocalDate, { ids: string[]; labels: string[] }>();
  for (const s of signs) {
    const day = byDay.get(s.on) ?? { ids: [], labels: [] };
    if (!day.ids.includes(s.id)) day.ids.push(s.id);
    if (!day.labels.includes(s.label)) day.labels.push(s.label);
    byDay.set(s.on, day);
  }
  return [...byDay].map(([on, d]) => ({ id: d.ids[0], on, text: `Quick check: ${d.labels.join(", ")}` }));
}

/** The quick checks saved after a day, which show the checks carried on. */
function checksAfter(input: NoticedInput, after: LocalDate): DayRecord[] {
  const seen = new Set<LocalDate>();
  return input.checks.filter((c) => c.on > after && !seen.has(c.on) && seen.add(c.on));
}

/** The quick checks saved since, as one row: "Quick checks saved on 84 days from 3 Aug to 25 Oct, none with “Weakness” ticked". */
function checksRow(checks: DayRecord[], none: string, today: LocalDate): Evidence {
  const first = checks[0];
  const last = checks[checks.length - 1];
  return {
    id: first.id,
    on: first.on,
    text: `Quick checks saved on ${days(checks.length)} from ${when(first.on, today)} to ${when(last.on, today)}, none with ${none} ticked`,
    ids: checks.map((c) => c.id),
  };
}

function checksCarriedOn(input: NoticedInput, after: LocalDate): DayRecord[] | null {
  const since = checksAfter(input, after);
  const latest = since[since.length - 1];
  if (since.length < THRESHOLDS.checksSince || !latest) return null;
  return daysBetween(latest.on, input.today) <= THRESHOLDS.lastCheckWithin ? since : null;
}

/** How far back the quick checks go, in days including today, or 0 when there are none. */
function checkDays(input: NoticedInput): number {
  const first = input.checks[0];
  return first ? daysBetween(first.on, input.today) + 1 : 0;
}

const valueEvidence = (v: ValueRecord, anchors: Anchor[]): Evidence => {
  const c = cycleOf(anchors, v.on);
  return { id: v.id, on: v.on, text: `Lab report: ${v.label} ${figure(v)}${c ? `, day ${c.day} after injection ${c.cycleNo}` : ""}` };
};

const byDate = (a: Evidence, b: Evidence) => a.on.localeCompare(b.on) || a.text.localeCompare(b.text);

function observation(o: Omit<Observation, "windowStart" | "windowEnd" | "records"> & { records: Evidence[]; today: LocalDate }): Observation {
  const records = [...o.records].sort(byDate);
  const { today, ...rest } = o;
  return { ...rest, records, windowStart: records[0]?.on ?? today, windowEnd: today };
}

// ---------------------------------------------------------------------------
// 1. Cycle position: a value or sign at the same point in 3 or more cycles
// ---------------------------------------------------------------------------

/**
 * A lab value moving the same way between the tests of each of the latest
 * cycles that had two or more, with the later tests at the same point.
 */
function valuesByCycle(input: NoticedInput): Observation[] {
  const { anchors, today } = input;
  if (anchors.length < THRESHOLDS.cycles) return [];
  const latestCycle = anchors[anchors.length - 1].cycleNo;
  const out: Observation[] = [];
  for (const key of [...new Set(input.values.map((v) => v.key))]) {
    const results = input.values.filter((v) => v.key === key);
    const cycles = new Map<number, { v: ValueRecord; day: number }[]>();
    for (const v of results) {
      const c = cycleOf(anchors, v.on);
      if (c) cycles.set(c.cycleNo, [...(cycles.get(c.cycleNo) ?? []), { v, day: c.day }]);
    }
    const tested = [...cycles]
      .filter(([, rs]) => rs.length >= 2)
      .sort((a, b) => a[0] - b[0])
      .map(([cycleNo, rs]) => ({ cycleNo, rs, dir: Math.sign(rs[rs.length - 1].v.value - rs[0].v.value), late: rs[rs.length - 1] }));

    // The run back from the latest tested cycle: the same way each time, the later tests within 5 days of each other.
    const run: typeof tested = [];
    for (let i = tested.length - 1; i >= 0; i--) {
      const c = tested[i];
      const lates = [...run, c].map((r) => r.late.day);
      if (c.dir === 0 || (run.length > 0 && c.dir !== run[0].dir) || Math.max(...lates) - Math.min(...lates) > THRESHOLDS.sameSpan) break;
      run.unshift(c);
    }
    if (run.length < THRESHOLDS.cycles || run[run.length - 1].cycleNo < latestCycle - 1) continue;

    const v = run[0].late.v;
    const shown = run.slice(-4);
    const rose = run[0].dir > 0;
    out.push(
      observation({
        family: "cycle_position",
        ruleKey: key,
        fingerprint: `cycle_position:${key}:${rose ? "up" : "down"}:${run[0].cycleNo}`,
        text: `${input.dogName}’s ${inSentence(v.label)} ${rose ? "rose" : "fell"} between tests in each of injection cycles ${joinList(
          shown.map((c) => String(c.cycleNo)),
        )}, to ${joinList(shown.map((c) => `${figure(c.late.v)} on day ${c.late.day}`))} after the injection.`,
        rule: `Tailhelm looks for a lab value that moves the same way between the tests in each of ${THRESHOLDS.cycles} or more injection cycles in a row, with the later tests within ${THRESHOLDS.sameSpan + 1} days of each other in the cycle.`,
        records: run.flatMap((c) => c.rs.map((r) => valueEvidence(r.v, anchors))),
        today,
      }),
    );
  }
  return out;
}

/** A sign logged within the same 5 days of the cycle in 3 or more cycles, the latest of them recent. */
function signsByCycle(input: NoticedInput): Observation[] {
  const { anchors, today } = input;
  if (anchors.length < THRESHOLDS.cycles) return [];
  const latestCycle = anchors[anchors.length - 1].cycleNo;
  const out: Observation[] = [];
  for (const key of [...new Set(input.signs.map((s) => s.key))]) {
    const logged = input.signs
      .filter((s) => s.key === key)
      .flatMap((s) => {
        const c = cycleOf(anchors, s.on);
        return c ? [{ s, ...c }] : [];
      });
    let best: typeof logged = [];
    for (const start of logged) {
      // For each cycle, its first day logged within 5 days from this one.
      const inSpan = new Map<number, (typeof logged)[number]>();
      for (const l of logged) {
        if (l.day >= start.day && l.day <= start.day + THRESHOLDS.sameSpan && !inSpan.has(l.cycleNo)) inSpan.set(l.cycleNo, l);
      }
      const set = [...inSpan.values()].sort((a, b) => a.cycleNo - b.cycleNo);
      const latest = (x: typeof logged) => x[x.length - 1]?.cycleNo ?? 0;
      if (set.length > best.length || (set.length === best.length && latest(set) > latest(best))) best = set;
    }
    if (best.length < THRESHOLDS.cycles || best[best.length - 1].cycleNo < latestCycle - 1) continue;
    const label = best[0].s.label;
    const shown = best.slice(-4);
    out.push(
      observation({
        family: "cycle_position",
        ruleKey: key,
        fingerprint: `cycle_position:sign:${key}:${best[0].cycleNo}`,
        text: `${quoted(label)} was logged at about the same point in ${best.length} injection cycles: ${joinList(
          shown.map((l) => `day ${l.day} after injection ${l.cycleNo}`),
        )}.`,
        rule: `Tailhelm looks for a sign logged within the same ${THRESHOLDS.sameSpan + 1} days of the injection cycle in ${THRESHOLDS.cycles} or more cycles, the latest of them this cycle or the one before.`,
        records: best.map((l) => ({ id: l.s.id, on: l.s.on, text: `Quick check: ${label}, day ${l.day} after injection ${l.cycleNo}` })),
        today,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Interval change: the latest gap much shorter or longer than usual
// ---------------------------------------------------------------------------

function intervals(input: NoticedInput): Observation[] {
  const { today } = input;
  const subjects: { key: string; times: { on: LocalDate; ids: string[] }[]; evidence: Evidence[]; sentence: (on: string, gap: string) => string; what: string }[] = [];
  for (const key of [...new Set(input.signs.map((s) => s.key))]) {
    const rows = input.signs.filter((s) => s.key === key);
    const label = rows[0].label;
    subjects.push({
      key,
      times: episodes(rows).map((e) => ({ on: e.start, ids: e.ids })),
      evidence: rows.map((s) => ({ id: s.id, on: s.on, text: `Quick check: ${label}` })),
      sentence: (on, gap) => `${quoted(label)} was logged on ${on}, ${gap}.`,
      what: "a sign",
    });
  }
  if (input.happenings.length > 0) {
    subjects.push({
      key: "happening_now",
      times: input.happenings.map((h) => ({ on: h.on, ids: [h.id] })),
      evidence: input.happenings,
      sentence: (on, gap) => `A Happening now record was started on ${on}, ${gap}.`,
      what: "Happening now",
    });
  }

  const out: Observation[] = [];
  for (const s of subjects) {
    if (s.times.length < THRESHOLDS.events) continue;
    const gaps = s.times.slice(1).map((t, i) => daysBetween(s.times[i].on, t.on));
    const latest = gaps[gaps.length - 1];
    const before = gaps.slice(0, -1);
    const usual = median(before);
    const last = s.times[s.times.length - 1];
    if (usual < THRESHOLDS.minUsualGap || daysBetween(last.on, today) > THRESHOLDS.intervalRecent) continue;
    if (latest * THRESHOLDS.intervalFactor > usual && latest < usual * THRESHOLDS.intervalFactor) continue;
    const gap = latest === 0 ? "the same day as the time before" : `${days(latest)} after the time before`;
    const earlier = before.slice(-4);
    out.push(
      observation({
        family: "interval_change",
        ruleKey: s.key,
        fingerprint: `interval_change:${s.key}:${last.on}`,
        text: `${s.sentence(when(last.on, today), gap)} Before that, the ${earlier.length === 1 ? "gap was" : "gaps were"} ${joinList(earlier.map(String))} ${
          earlier.length === 1 && earlier[0] === 1 ? "day" : "days"
        }.`,
        rule: `Tailhelm looks at the time between the last ${THRESHOLDS.events} or more times ${s.what} was logged, and notices when the latest gap is half or less, or twice or more, the usual gap before it. Days in a row count as one time.`,
        records: s.evidence,
        today,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Co-occurrence: signs logged with a stressful day, or at one point of the cycle
// ---------------------------------------------------------------------------

/** The last 4 times any sign was logged, once there are 30 days of quick checks. */
function lastTimes(input: NoticedInput): Episode[] | null {
  if (checkDays(input) < THRESHOLDS.coDays) return null;
  const times = episodes(signDays(input.signs));
  return times.length >= THRESHOLDS.coOf ? times.slice(-THRESHOLDS.coOf) : null;
}

function withStress(input: NoticedInput): Observation[] {
  const { today } = input;
  const times = lastTimes(input);
  if (!times || input.stress.length === 0) return [];
  const matched = times.flatMap((t) => {
    const stress = input.stress.filter((s) => s.on <= t.start && daysBetween(s.on, t.start) <= THRESHOLDS.afterStress).pop();
    return stress ? [{ t, stress }] : [];
  });
  if (matched.length < THRESHOLDS.coMatch) return [];
  const evidence = signDays(input.signs).filter((d) => times.some((t) => d.on >= t.start && d.on <= t.end));
  return [
    observation({
      family: "co_occurrence",
      ruleKey: "stress",
      fingerprint: `co_occurrence:stress:${matched[matched.length - 1].t.start}`,
      text: `Of the last ${times.length} times a sign was logged, ${matched.length} were on a stressful day or within ${days(THRESHOLDS.afterStress)} after one: ${joinList(
        matched.map((m) => `${when(m.t.start, today)} (${m.stress.text})`),
      )}.`,
      rule: `Tailhelm looks at the last ${THRESHOLDS.coOf} times a sign was logged, and notices when ${THRESHOLDS.coMatch} or more were on a stressful day or within ${days(THRESHOLDS.afterStress)} after one. Days in a row count as one time. It needs ${THRESHOLDS.coDays} days of quick checks.`,
      records: [...evidence, ...matched.map((m) => ({ id: m.stress.id, on: m.stress.on, text: `Stressful day: ${m.stress.text}` }))],
      today,
    }),
  ];
}

function withCycleDay(input: NoticedInput): Observation[] {
  const { today, anchors } = input;
  const times = lastTimes(input);
  if (!times || anchors.length === 0) return [];
  const placed = times.flatMap((t) => {
    const c = cycleOf(anchors, t.start);
    return c ? [{ t, ...c }] : [];
  });
  let best: typeof placed = [];
  for (const start of placed) {
    const set = placed.filter((p) => p.day >= start.day && p.day <= start.day + THRESHOLDS.sameSpan);
    if (set.length > best.length) best = set;
  }
  if (best.length < THRESHOLDS.coMatch || new Set(best.map((b) => b.cycleNo)).size < 2) return [];
  const lo = Math.min(...best.map((b) => b.day));
  const hi = Math.max(...best.map((b) => b.day));
  const evidence = signDays(input.signs).filter((d) => best.some((b) => d.on >= b.t.start && d.on <= b.t.end));
  return [
    observation({
      family: "co_occurrence",
      ruleKey: "cycle_day",
      fingerprint: `co_occurrence:cycle_day:${best[best.length - 1].t.start}`,
      text: `Of the last ${times.length} times a sign was logged, ${best.length} were between day ${lo} and day ${hi} after an injection: ${joinList(
        best.map((b) => `${when(b.t.start, today)} (day ${b.day})`),
      )}.`,
      rule: `Tailhelm looks at the last ${THRESHOLDS.coOf} times a sign was logged, and notices when ${THRESHOLDS.coMatch} or more were within the same ${THRESHOLDS.sameSpan + 1} days of an injection cycle, in more than one cycle. Days in a row count as one time. It needs ${THRESHOLDS.coDays} days of quick checks.`,
      records: evidence.map((e) => {
        const c = cycleOf(anchors, e.on);
        return c ? { ...e, text: `${e.text}, day ${c.day} after injection ${c.cycleNo}` } : e;
      }),
      today,
    }),
  ];
}

// ---------------------------------------------------------------------------
// 4. Direction: a worked-out value moving the same way across 3 or more results
// ---------------------------------------------------------------------------

function direction(input: NoticedInput): Observation[] {
  const { today } = input;
  const out: Observation[] = [];
  for (const key of [...new Set(input.values.filter((v) => v.derived).map((v) => v.key))]) {
    const results = input.values.filter((v) => v.key === key);
    const run = [results[results.length - 1]];
    for (let i = results.length - 2; i >= 0; i--) {
      const step = Math.sign(run[0].value - results[i].value);
      const way = run.length > 1 ? Math.sign(run[1].value - run[0].value) : step;
      if (step === 0 || step !== way) break;
      run.unshift(results[i]);
    }
    if (run.length < THRESHOLDS.results) continue;
    const rose = run[1].value > run[0].value;
    const shown = run.slice(-5);
    out.push(
      observation({
        family: "direction",
        ruleKey: key,
        fingerprint: `direction:${key}:${rose ? "up" : "down"}:${run[0].id}`,
        text: `${input.dogName}’s ${inSentence(run[0].label)} has ${rose ? "risen" : "fallen"} across the last ${run.length} results: ${joinList(
          shown.map((v) => `${figure(v)} on ${when(v.on, today)}`),
        )}.`,
        rule: `Tailhelm looks for a value it works out from a lab report, such as the ${run[0].label}, that moves the same way across ${THRESHOLDS.results} or more results in a row.`,
        records: run.map((v) => valueEvidence(v, input.anchors)),
        today,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Absence: a sign logged regularly that has stopped being logged
// ---------------------------------------------------------------------------

function absence(input: NoticedInput): Observation[] {
  const { today } = input;
  if (checkDays(input) < THRESHOLDS.absenceDays) return [];
  const out: Observation[] = [];
  for (const key of [...new Set(input.signs.map((s) => s.key))]) {
    const rows = input.signs.filter((s) => s.key === key);
    const times = episodes(rows);
    if (times.length < THRESHOLDS.absenceTimes) continue;
    const usual = median(times.slice(1).map((t, i) => daysBetween(times[i].start, t.start)));
    const last = times[times.length - 1].end;
    const since = daysBetween(last, today);
    if (since < Math.max(THRESHOLDS.absenceMinDays, THRESHOLDS.absenceFactor * usual)) continue;
    const checks = checksCarriedOn(input, last);
    if (!checks) continue;
    const label = rows[0].label;
    out.push(
      observation({
        family: "absence",
        ruleKey: key,
        fingerprint: `absence:${key}:${last}`,
        text: `${quoted(label)} has not been logged since ${when(last, today)}, ${days(since)} ago. Before that it was logged about every ${days(
          Math.round(usual),
        )}, from ${when(times[0].start, today)}. Quick checks were saved on ${days(checks.length)} since.`,
        rule: `Tailhelm looks for a sign logged at least ${THRESHOLDS.absenceTimes} times that has then not been logged for ${THRESHOLDS.absenceFactor} times its usual gap, and at least ${THRESHOLDS.absenceMinDays} days, while quick checks were still saved. Days in a row count as one time. It needs ${THRESHOLDS.absenceDays} days of quick checks.`,
        records: [
          ...rows.map((s) => ({ id: s.id, on: s.on, text: `Quick check: ${label}` })),
          checksRow(checks, quoted(label), today),
        ],
        today,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. Plain record: a factual longest
// ---------------------------------------------------------------------------

/** The time since a sign was last logged, once it is the longest since the quick checks began. */
function longestGap(input: NoticedInput): Observation[] {
  const { today } = input;
  if (checkDays(input) < THRESHOLDS.plainDays) return [];
  const logged = signDays(input.signs);
  if (logged.length < 3) return [];
  const last = logged[logged.length - 1].on;
  const since = daysBetween(last, today);
  // The gaps between days a sign was logged, and the one from the first quick check to the first of them.
  const longest = Math.max(daysBetween(input.checks[0].on, logged[0].on), ...logged.slice(1).map((d, i) => daysBetween(logged[i].on, d.on)));
  if (since < THRESHOLDS.plainMinGap || since <= longest) return [];
  const checks = checksCarriedOn(input, last);
  if (!checks) return [];
  return [
    observation({
      family: "plain_record",
      ruleKey: "longest_gap",
      fingerprint: `plain_record:longest_gap:${last}`,
      text: `No sign has been logged on ${input.dogName}’s quick check for ${days(since)}, since ${when(last, today)}. That is the longest time without one since the quick checks began on ${when(
        input.checks[0].on,
        today,
      )}. Quick checks were saved on ${days(checks.length)} since.`,
      rule: `Tailhelm notices when the time since a sign was last logged becomes the longest since the quick checks began, once it is at least ${THRESHOLDS.plainMinGap} days and quick checks are still saved. It needs ${THRESHOLDS.plainDays} days of quick checks.`,
      records: [...logged, checksRow(checks, "a sign", today)],
      today,
    }),
  ];
}
