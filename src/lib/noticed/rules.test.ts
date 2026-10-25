import { describe, expect, it } from "vitest";
import { type LocalDate, addDays } from "@/engine/time";
import { historyStart } from "@/lib/history/window";
import {
  type Anchor,
  type DayRecord,
  type NoticedInput,
  type Observation,
  type SignRecord,
  type ValueRecord,
  FAMILIES,
  allNoticed,
  chooseNoticed,
  dueForNoticed,
} from "./rules";

const TODAY = "2026-10-25";
/** The voice rules, plus anything that would read as advice or a dose. */
const BANNED =
  /\b(safe|normal|fine|good|bad|better|worse|healthy|unhealthy|streak|compliance|administer|dosage|dose|doses|dosing|should|must|increase|decrease|reduce|worry|worrying|concern|risk)\b/i;

function input(over: Partial<NoticedInput>): NoticedInput {
  return { dogName: "Bella", today: TODAY, from: null, values: [], signs: [], checks: [], happenings: [], stress: [], anchors: [], ...over };
}

let n = 0;
const id = (p: string) => `${p}-${++n}`;

const potassium = (on: LocalDate, value: number): ValueRecord => ({
  id: id("k"),
  on,
  key: "potassium",
  label: "Potassium",
  unit: "mmol/L",
  value,
  derived: false,
});
const ratio = (on: LocalDate, value: number): ValueRecord => ({
  id: id("r"),
  on,
  key: "na_k_ratio",
  label: "Na:K ratio",
  unit: null,
  value,
  derived: true,
});
const sign = (on: LocalDate, key = "weakness", label = "Weakness"): SignRecord => ({ id: id("s"), on, key, label });
const day = (on: LocalDate, text: string): DayRecord => ({ id: id("d"), on, text });

/** A quick check saved every day from `from` to today. */
function dailyChecks(from: LocalDate): DayRecord[] {
  const out: DayRecord[] = [];
  for (let d = from; d <= TODAY; d = addDays(d, 1)) out.push(day(d, "Quick check"));
  return out;
}

/** Injections every 28 days: cycle 1 on 1 Jul to cycle 5 on 21 Oct. */
const ANCHORS: Anchor[] = [
  { on: "2026-07-01", cycleNo: 1 },
  { on: "2026-07-29", cycleNo: 2 },
  { on: "2026-08-26", cycleNo: 3 },
  { on: "2026-09-23", cycleNo: 4 },
  { on: "2026-10-21", cycleNo: 5 },
];

const of = (found: Observation[], family: string) => found.filter((o) => o.family === family);

describe("cycle position", () => {
  const cycles = input({
    anchors: ANCHORS,
    values: [
      potassium("2026-08-08", 4.5),
      potassium("2026-08-22", 5.2),
      potassium("2026-09-05", 4.6),
      potassium("2026-09-20", 5.3),
      potassium("2026-10-03", 4.4),
      potassium("2026-10-19", 5.4),
    ],
  });

  it("finds a lab value moving the same way between tests in three cycles in a row", () => {
    const [o] = of(allNoticed(cycles), "cycle_position");
    expect(o.text).toBe(
      "Bella’s potassium rose between tests in each of injection cycles 2, 3 and 4, to 5.2 mmol/L on day 24, 5.3 mmol/L on day 25 and 5.4 mmol/L on day 26 after the injection.",
    );
    expect(o.fingerprint).toBe("cycle_position:potassium:up:2");
    expect(o.records.map((r) => r.text)).toEqual([
      "Lab report: Potassium 4.5 mmol/L, day 10 after injection 2",
      "Lab report: Potassium 5.2 mmol/L, day 24 after injection 2",
      "Lab report: Potassium 4.6 mmol/L, day 10 after injection 3",
      "Lab report: Potassium 5.3 mmol/L, day 25 after injection 3",
      "Lab report: Potassium 4.4 mmol/L, day 10 after injection 4",
      "Lab report: Potassium 5.4 mmol/L, day 26 after injection 4",
    ]);
    expect(o.windowStart).toBe("2026-08-08");
    expect(o.windowEnd).toBe(TODAY);
  });

  it("says nothing when the later tests are more than 5 days apart in the cycle", () => {
    const spread = input({
      ...cycles,
      values: cycles.values.map((v) => (v.on === "2026-10-19" ? { ...v, on: "2026-10-12" } : v)),
    });
    expect(of(allNoticed(spread), "cycle_position")).toEqual([]);
  });

  it("says nothing when one of the cycles went the other way", () => {
    const mixed = input({ ...cycles, values: cycles.values.map((v) => (v.on === "2026-09-20" ? { ...v, value: 4.1 } : v)) });
    expect(of(allNoticed(mixed), "cycle_position")).toEqual([]);
  });

  it("finds a sign logged at the same point in three cycles", () => {
    const signs = input({ anchors: ANCHORS, signs: [sign("2026-08-22"), sign("2026-09-20"), sign("2026-10-19")] });
    const [o] = of(allNoticed(signs), "cycle_position");
    expect(o.text).toBe(
      "“Weakness” was logged at about the same point in 3 injection cycles: day 24 after injection 2, day 25 after injection 3 and day 26 after injection 4.",
    );
    expect(o.records).toHaveLength(3);
  });

  it("needs the latest of the cycles to be this one or the one before", () => {
    const old = input({ anchors: ANCHORS, signs: [sign("2026-07-24"), sign("2026-08-22"), sign("2026-09-20")] });
    expect(of(allNoticed(old), "cycle_position")).toEqual([]);
  });
});

describe("interval change", () => {
  it("finds a gap much shorter than the usual one", () => {
    const happenings = ["2026-07-01", "2026-08-04", "2026-09-06", "2026-10-10", "2026-10-21"].map((on) => day(on, "Happening now"));
    const [o] = of(allNoticed(input({ happenings })), "interval_change");
    expect(o.text).toBe("A Happening now record was started on 21 Oct, 11 days after the time before. Before that, the gaps were 34, 33 and 34 days.");
    expect(o.fingerprint).toBe("interval_change:happening_now:2026-10-21");
    expect(o.records).toHaveLength(5);
  });

  it("finds a gap much longer than the usual one, counting days in a row as one time", () => {
    const signs = ["2026-08-01", "2026-08-02", "2026-08-08", "2026-08-15", "2026-08-22", "2026-10-20"].map((on) => sign(on, "vomiting", "Vomiting"));
    const [o] = of(allNoticed(input({ signs })), "interval_change");
    expect(o.text).toBe("“Vomiting” was logged on 20 Oct, 59 days after the time before. Before that, the gaps were 7, 7 and 7 days.");
  });

  it("says nothing when the gaps stay about the same", () => {
    const signs = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-10-01"].map((on) => sign(on));
    expect(of(allNoticed(input({ signs })), "interval_change")).toEqual([]);
  });

  it("needs 4 times", () => {
    const happenings = ["2026-08-04", "2026-09-06", "2026-10-21"].map((on) => day(on, "Happening now"));
    expect(of(allNoticed(input({ happenings })), "interval_change")).toEqual([]);
  });
});

describe("co-occurrence", () => {
  it("finds signs logged on or just after stressful days", () => {
    const found = allNoticed(
      input({
        checks: dailyChecks("2026-09-20"),
        signs: [sign("2026-09-28", "panting", "Panting"), sign("2026-10-06", "panting", "Panting"), sign("2026-10-14", "panting", "Panting"), sign("2026-10-22", "panting", "Panting")],
        stress: [day("2026-09-27", "Grooming"), day("2026-10-05", "Vet visit"), day("2026-10-22", "Fireworks")],
      }),
    );
    const [o] = of(found, "co_occurrence");
    expect(o.text).toBe(
      "Of the last 4 times a sign was logged, 3 were on a stressful day or within 2 days after one: 28 Sep (Grooming), 6 Oct (Vet visit) and 22 Oct (Fireworks).",
    );
    expect(o.records.map((r) => r.text)).toEqual([
      "Stressful day: Grooming",
      "Quick check: Panting",
      "Stressful day: Vet visit",
      "Quick check: Panting",
      "Quick check: Panting",
      "Quick check: Panting",
      "Stressful day: Fireworks",
    ]);
  });

  it("needs 30 days of quick checks", () => {
    const found = allNoticed(
      input({
        checks: dailyChecks("2026-09-27"),
        signs: [sign("2026-09-28"), sign("2026-10-06"), sign("2026-10-14"), sign("2026-10-22")],
        stress: [day("2026-09-27", "Grooming"), day("2026-10-05", "Vet visit"), day("2026-10-22", "Fireworks")],
      }),
    );
    expect(of(found, "co_occurrence")).toEqual([]);
  });

  it("finds signs logged at the same point of the cycle in more than one cycle", () => {
    const anchors: Anchor[] = [
      { on: "2026-08-20", cycleNo: 1 },
      { on: "2026-09-17", cycleNo: 2 },
      { on: "2026-10-15", cycleNo: 3 },
    ];
    const found = allNoticed(
      input({ anchors, checks: dailyChecks("2026-09-01"), signs: [sign("2026-09-14"), sign("2026-09-28"), sign("2026-10-11"), sign("2026-10-13")] }),
    );
    const [o] = of(found, "co_occurrence");
    expect(o.text).toBe(
      "Of the last 4 times a sign was logged, 3 were between day 24 and day 26 after an injection: 14 Sep (day 25), 11 Oct (day 24) and 13 Oct (day 26).",
    );
    expect(o.records.map((r) => r.text)).toEqual([
      "Quick check: Weakness, day 25 after injection 1",
      "Quick check: Weakness, day 24 after injection 2",
      "Quick check: Weakness, day 26 after injection 2",
    ]);
  });
});

describe("direction", () => {
  it("finds a worked-out value moving the same way across the last results", () => {
    const values = [ratio("2026-09-20", 31.5), ratio("2026-10-01", 30.1), ratio("2026-10-08", 28.4), ratio("2026-10-15", 27.2), ratio("2026-10-22", 26)];
    // The first result went up to the second, so the run starts at the second.
    values.unshift(ratio("2026-09-01", 29));
    const [o] = of(allNoticed(input({ values })), "direction");
    expect(o.text).toBe("Bella’s Na:K ratio has fallen across the last 5 results: 31.5 on 20 Sep, 30.1 on 1 Oct, 28.4 on 8 Oct, 27.2 on 15 Oct and 26.0 on 22 Oct.");
    expect(o.fingerprint).toBe(`direction:na_k_ratio:down:${values[1].id}`);
    expect(o.records.map((r) => r.text)[0]).toBe("Lab report: Na:K ratio 31.5");
  });

  it("looks only at worked-out values, not the numbers typed in", () => {
    const values = [potassium("2026-10-01", 4.4), potassium("2026-10-08", 4.8), potassium("2026-10-15", 5.1)];
    expect(of(allNoticed(input({ values })), "direction")).toEqual([]);
  });

  it("stops at a result that did not move", () => {
    const values = [ratio("2026-10-01", 30), ratio("2026-10-08", 28), ratio("2026-10-15", 28), ratio("2026-10-22", 27)];
    expect(of(allNoticed(input({ values })), "direction")).toEqual([]);
  });
});

describe("absence", () => {
  const signs = ["2026-06-03", "2026-06-13", "2026-06-23", "2026-07-03", "2026-07-13", "2026-07-23", "2026-08-02"].map((on) =>
    sign(on, "lethargy", "Less energy than usual"),
  );

  it("finds a sign that came regularly and has not been logged since", () => {
    const [o] = of(allNoticed(input({ signs, checks: dailyChecks("2026-06-01") })), "absence");
    expect(o.text).toBe(
      "“Less energy than usual” has not been logged since 2 Aug, 84 days ago. Before that it was logged about every 10 days, from 3 Jun. Quick checks were saved on 84 days since.",
    );
    expect(o.fingerprint).toBe("absence:lethargy:2026-08-02");
    const last = o.records[o.records.length - 1];
    expect(last.text).toBe("Quick checks saved on 84 days from 3 Aug to 25 Oct, none with “Less energy than usual” ticked");
    expect(last.ids).toHaveLength(84);
  });

  it("says nothing once the quick checks stopped too", () => {
    const checks = dailyChecks("2026-06-01").filter((c) => c.on <= "2026-10-10");
    expect(of(allNoticed(input({ signs, checks })), "absence")).toEqual([]);
  });

  it("needs 90 days of quick checks", () => {
    expect(of(allNoticed(input({ signs, checks: dailyChecks("2026-08-01") })), "absence")).toEqual([]);
  });
});

describe("plain record", () => {
  const signs = [
    sign("2026-07-05", "vomiting", "Vomiting"),
    sign("2026-07-15", "panting", "Panting"),
    sign("2026-07-28", "vomiting", "Vomiting"),
    sign("2026-08-10", "panting", "Panting"),
    sign("2026-08-20", "vomiting", "Vomiting"),
  ];

  it("finds the longest time without a sign since the quick checks began", () => {
    const found = allNoticed(input({ signs, checks: dailyChecks("2026-07-01") }));
    expect(found.map((o) => o.family)).toEqual(["plain_record"]);
    expect(found[0].text).toBe(
      "No sign has been logged on Bella’s quick check for 66 days, since 20 Aug. That is the longest time without one since the quick checks began on 1 Jul. Quick checks were saved on 66 days since.",
    );
  });

  it("counts the time before the first sign as a gap too", () => {
    const late = signs.map((s) => ({ ...s, on: s.on === "2026-07-05" ? "2026-04-01" : s.on }));
    expect(allNoticed(input({ signs: late, checks: dailyChecks("2026-01-01") }))).toEqual([]);
  });
});

describe("the free plan's 30 days", () => {
  it("finds nothing the last 30 days cannot support", () => {
    const values = [potassium("2026-08-08", 4.5), potassium("2026-08-22", 5.2), potassium("2026-09-05", 4.6), potassium("2026-09-20", 5.3), potassium("2026-10-03", 4.4), potassium("2026-10-19", 5.4)];
    expect(allNoticed(input({ anchors: ANCHORS, values, from: historyStart(TODAY, false) }))).toEqual([]);
    expect(allNoticed(input({ anchors: ANCHORS, values, from: historyStart(TODAY, true) }))).toHaveLength(1);
  });

  it("still finds the thin ones honestly", () => {
    const values = [ratio("2026-10-01", 30.1), ratio("2026-10-08", 28.4), ratio("2026-10-15", 27.2)];
    expect(allNoticed(input({ values, from: historyStart(TODAY, false) })).map((o) => o.family)).toEqual(["direction"]);
  });

  it("ignores anything after today", () => {
    const values = [ratio("2026-10-08", 28.4), ratio("2026-10-15", 27.2), ratio("2026-10-26", 26)];
    expect(allNoticed(input({ values }))).toEqual([]);
  });
});

describe("choosing one a week", () => {
  const both = input({
    anchors: ANCHORS,
    values: [ratio("2026-10-01", 30.1), ratio("2026-10-08", 28.4), ratio("2026-10-15", 27.2)],
    signs: [sign("2026-08-22"), sign("2026-09-20"), sign("2026-10-19")],
  });

  it("takes the families in the spec's order", () => {
    expect(chooseNoticed(both, new Set())?.family).toBe("cycle_position");
  });

  it("never shows the same finding twice", () => {
    const first = chooseNoticed(both, new Set())!;
    const second = chooseNoticed(both, new Set([first.fingerprint]))!;
    expect(second.family).toBe("direction");
    expect(chooseNoticed(both, new Set([first.fingerprint, second.fingerprint]))).toBeNull();
  });

  it("is due when there is none yet or the last is a week old", () => {
    expect(dueForNoticed(null, TODAY)).toBe(true);
    expect(dueForNoticed("2026-10-19", TODAY)).toBe(false);
    expect(dueForNoticed("2026-10-18", TODAY)).toBe(true);
  });

  it("lists the families in the spec's order", () => {
    expect(FAMILIES).toEqual(["cycle_position", "interval_change", "co_occurrence", "direction", "absence", "plain_record"]);
  });
});

describe("wording", () => {
  it("states numbers and dates, never a judgement, an action or a dose", () => {
    const all = [
      input({ anchors: ANCHORS, values: [potassium("2026-08-08", 4.5), potassium("2026-08-22", 5.2), potassium("2026-09-05", 4.6), potassium("2026-09-20", 5.3), potassium("2026-10-03", 4.4), potassium("2026-10-19", 5.4)] }),
      input({ anchors: ANCHORS, signs: [sign("2026-08-22"), sign("2026-09-20"), sign("2026-10-19")] }),
      input({ happenings: ["2026-07-01", "2026-08-04", "2026-09-06", "2026-10-10", "2026-10-21"].map((on) => day(on, "Happening now")) }),
      input({
        checks: dailyChecks("2026-09-20"),
        signs: [sign("2026-09-28"), sign("2026-10-06"), sign("2026-10-14"), sign("2026-10-22")],
        stress: [day("2026-09-27", "Grooming"), day("2026-10-05", "Kennels"), day("2026-10-22", "Fireworks")],
      }),
      input({ values: [ratio("2026-10-01", 30.1), ratio("2026-10-08", 28.4), ratio("2026-10-15", 27.2)] }),
      input({
        checks: dailyChecks("2026-06-01"),
        signs: ["2026-06-03", "2026-06-13", "2026-06-23", "2026-07-03", "2026-08-02"].map((on) => sign(on, "lethargy", "Less energy than usual")),
      }),
      input({ checks: dailyChecks("2026-07-01"), signs: [sign("2026-07-05", "vomiting", "Vomiting"), sign("2026-07-15"), sign("2026-08-20", "panting", "Panting")] }),
    ].flatMap(allNoticed);
    expect(new Set(all.map((o) => o.family))).toEqual(new Set(FAMILIES));
    for (const o of all) {
      const words = [o.text, o.rule, ...o.records.map((r) => r.text)].join(" ");
      expect(words).not.toMatch(BANNED);
      expect(o.text).not.toMatch(/\bvet\b/i);
      expect(o.text).not.toMatch(/\b(she|he|her|his|him)\b/i);
    }
  });
});
