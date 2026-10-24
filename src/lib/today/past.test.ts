import { describe, expect, it } from "vitest";
import { type PastInput, filterDays, monthMeta, pastDays, pastMonths } from "./past";

const tz = "Europe/London";
const signs = [
  { key: "vomiting", label: "Vomiting" },
  { key: "weakness", label: "Weakness" },
];

const empty: PastInput = {
  items: [
    { id: "pred", product: "Prednisolone", schedule_json: { kind: "fixed" } },
    { id: "zyc", product: "Zycortal", schedule_json: { kind: "interval" } },
  ],
  doses: [],
  observations: [],
  notes: [],
  stress: [],
  happenings: [],
  signs,
  signsKey: "signs",
  labTypes: [{ key: "electrolytes", name: "Sodium and potassium blood test" }],
};

const dose = (id: string, on: string, slot: string, at: string, by: string, over: Partial<PastInput["doses"][number]> = {}) => ({
  id,
  plan_item_id: "pred",
  given_at: at,
  given_on: on,
  slot,
  extra_no: 0,
  given_by_profile: by,
  given_by: null,
  note: null,
  ...over,
});

const obs = (id: string, type_key: string, at: string, by: string, values: Record<string, unknown>, over: Partial<PastInput["observations"][number]> = {}) => ({
  id,
  type_key,
  taken_at: at,
  created_at: at,
  values_json: values,
  scale: null,
  recorded_by: by,
  ...over,
});

const input: PastInput = {
  ...empty,
  doses: [
    dose("t1", "2026-10-16", "08:00", "2026-10-16T07:03:00Z", "sam"),
    dose("t2", "2026-10-16", "08:00", "2026-10-16T07:20:00Z", "sam", { extra_no: 1, note: "grooming" }),
    dose("t3", "2026-10-16", "18:00", "2026-10-16T17:06:00Z", "ade"),
    dose("t4", "2026-09-22", "injection", "2026-09-22T09:40:00Z", "sam", { plan_item_id: "zyc", given_by: "Larkfield Vets" }),
    // Ticked the next morning for the evening before.
    dose("t5", "2026-09-30", "18:00", "2026-10-01T06:30:00Z", "ade"),
  ],
  observations: [
    obs("o1", "signs", "2026-10-16T17:30:00Z", "ade", { weakness: true, vomiting: true }),
    obs("o2", "weight", "2026-09-22T09:45:00Z", "sam", { kg: 24.6 }, { scale: "clinic" }),
    // A weight typed in two days later: no time, as none was recorded.
    obs("o3", "weight", "2026-10-15T11:00:00Z", "ade", { kg: 24.4 }, { scale: "home", created_at: "2026-10-17T08:00:00Z" }),
    obs("o4", "electrolytes", "2026-09-22T13:20:00Z", "ade", { sodium: 146 }),
  ],
  notes: [{ id: "n1", started_at: "2026-10-16T18:40:00Z", note: "Calm after grooming", recorded_by: "ade", created_at: "2026-10-16T18:40:00Z" }],
  stress: [{ id: "e1", note: "Kennels", started_at: "2026-10-15T09:00:00Z", ended_at: "2026-10-16T18:00:00Z", recorded_by: "sam" }],
  happenings: [{ id: "h1", note: "Wobbly after", started_at: "2026-10-16T02:12:00Z", ended_at: "2026-10-16T02:16:12Z", recorded_by: "ade" }],
};

describe("pastDays", () => {
  it("lists every kind of record on its day, in the order of the day, with its mark and who recorded it", () => {
    const days = pastDays(input, "2026-10-17", tz);
    // The dose ticked on 1 Oct for the evening before stays on 30 Sep.
    expect(days.map((d) => d.date)).toEqual(["2026-10-16", "2026-10-15", "2026-09-30", "2026-09-22"]);
    expect(days[0].records.map((r) => [r.time, r.mark, r.text, r.by])).toEqual([
      [null, "note", "Stressful day: Kennels", "sam"],
      ["03:12", "hnow", "Happening now, 4 min 12 s", "ade"],
      ["08:00", "pred", "Prednisolone · given 08:03", "sam"],
      ["08:20", "pred", "Extra Prednisolone, grooming", "sam"],
      ["18:00", "pred", "Prednisolone · given 18:06", "ade"],
      ["18:30", "chk", "Quick check: Vomiting, Weakness", "ade"],
      ["19:40", "note", "Note: Calm after grooming", "ade"],
    ]);
    expect(days[0].records[1].note).toBe("Wobbly after");
    expect(days[1].records.map((r) => [r.time, r.text])).toEqual([
      [null, "Stressful day: Kennels"],
      [null, "Weight 24.4 kg · home scale"],
    ]);
    expect(days[2].records.map((r) => r.text)).toEqual(["Prednisolone · given 1 Oct, 07:30"]);
    expect(days[3].records.map((r) => [r.time, r.mark, r.text, r.by])).toEqual([
      ["10:40", "zyc", "Zycortal injection · Larkfield Vets", "sam"],
      ["10:45", "meas", "Weight 24.6 kg · clinic scale", "sam"],
      ["14:20", "meas", "Lab report: Sodium and potassium blood test", "ade"],
    ]);
  });

  it("keeps to the free plan's 30 days, and reaches back to the first record on Plus", () => {
    const old = { ...empty, doses: [dose("t9", "2026-08-01", "08:00", "2026-08-01T07:00:00Z", "ade")] };
    expect(pastDays(old, "2026-10-17", tz)).toEqual([]);
    expect(pastDays(old, "2026-10-17", tz, null).map((d) => d.date)).toEqual(["2026-08-01"]);
  });

  it("leaves out the future, and checks with nothing the pack lists", () => {
    const later = {
      ...empty,
      stress: [{ id: "e2", note: "Bonfire night", started_at: "2026-11-05T17:00:00Z", ended_at: null }],
      observations: [obs("o9", "signs", "2026-10-10T10:00:00Z", "ade", { other: true, weakness: false })],
    };
    expect(pastDays(later, "2026-10-17", tz)).toEqual([]);
  });
});

describe("pastMonths", () => {
  it("groups days by month, latest first, with what each month holds", () => {
    const months = pastMonths(pastDays(input, "2026-10-17", tz), "2026-09-18");
    expect(months.map((m) => [m.key, m.days.length, monthMeta(m)])).toEqual([
      ["2026-10", 2, "2 days · 3 doses ticked · 1 weight"],
      ["2026-09", 2, "from 18 Sep · 2 days · 1 dose ticked · 1 injection · 1 weight · 1 lab report"],
    ]);
  });

  it("says nothing about days without records", () => {
    const meta = pastMonths(pastDays(input, "2026-10-17", tz), "2026-09-18").map(monthMeta).join(" ");
    expect(meta).not.toMatch(/missed|skipped|gap|%|safe|normal|good|bad/i);
  });
});

describe("filterDays", () => {
  it("keeps one kind of record and drops days left empty", () => {
    const days = pastDays(input, "2026-10-17", tz);
    expect(filterDays(days, "measurements").map((d) => [d.date, d.records.length])).toEqual([
      ["2026-10-15", 1],
      ["2026-09-22", 2],
    ]);
    expect(filterDays(days, null)).toBe(days);
  });
});
