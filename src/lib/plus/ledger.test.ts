import { describe, expect, it } from "vitest";
import addisons from "../../../packs/addisons.pack.json";
import type { ExportData, ExportObservation, ExportPlanItem, ExportTreatment } from "@/lib/export/csv";
import { ConditionPack } from "@/packs/schema";
import { buildLedger } from "./ledger";

const pack = ConditionPack.parse(addisons);
const packFor = (key: string) => (key === "addisons" ? pack : null);
const tz = "Europe/London";

const item = (over: Partial<ExportPlanItem>): ExportPlanItem => ({
  id: "p1",
  dog_condition_id: "c1",
  product: "Prednisolone",
  strength: "5 mg tablets",
  dose_amount: 2.5,
  dose_unit: "mg",
  schedule_json: { kind: "fixed", times: ["08:00", "18:00"] },
  set_by_vet_on: "2026-09-12",
  vet_instructions: null,
  active: true,
  supersedes_id: null,
  created_at: "2026-09-17T09:00:00Z",
  created_by: "ade",
  ...over,
});

const tick = (on: string, by: string | null, over: Partial<ExportTreatment> = {}): ExportTreatment => ({
  plan_item_id: "p1",
  given_at: `${on}T07:05:00Z`,
  given_on: on,
  slot: "08:00",
  extra_no: 0,
  amount: null,
  unit: null,
  given_by_profile: by,
  given_by: null,
  site: null,
  vial_id: null,
  note: null,
  ...over,
});

const obs = (type_key: string, at: string, by: string, over: Partial<ExportObservation> = {}): ExportObservation => ({
  dog_condition_id: "c1",
  type_key,
  taken_at: at,
  values_json: {},
  ranges_json: null,
  derived_json: null,
  cycle_no: null,
  days_since_anchor: null,
  note: null,
  recorded_by: by,
  scale: null,
  ...over,
});

const data: ExportData = {
  dogs: [],
  conditions: [{ id: "c1", dog_id: "d1", condition_key: "addisons", name: "Addison's disease", pack_version: "0.2.0", variant: null, diagnosed_on: null }],
  planItems: [
    item({}),
    item({ id: "p2", product: "Zycortal", strength: "25 mg/ml", dose_amount: 1.1, dose_unit: "ml", schedule_json: { kind: "interval", everyDays: 28, time: "09:00" } }),
  ],
  treatments: [
    tick("2026-09-17", "ade"),
    tick("2026-09-17", "sam", { slot: "18:00" }),
    tick("2026-09-18", "ade"),
    tick("2026-10-16", "sam", { extra_no: 1 }),
    tick("2026-09-16", "ade"), // the day before the month
    tick("2026-09-22", "sam", { plan_item_id: "p2", slot: "injection", amount: 1.1, unit: "ml" }),
  ],
  vials: [],
  observations: [
    obs("signs", "2026-09-20T17:30:00Z", "ade", { values_json: { vomiting: true } }),
    obs("signs", "2026-10-01T17:30:00Z", "sam", { values_json: { lethargy: true } }),
    obs("weight", "2026-09-22T09:45:00Z", "sam", { values_json: { kg: 24.6 }, scale: "clinic" }),
    obs("weight", "2026-10-15T07:15:00Z", "ade", { values_json: { kg: 24.4 }, scale: "home" }),
    obs("weight", "2026-10-08T07:15:00Z", "ade", { values_json: { kg: 24.5 }, scale: "home" }),
    obs("electrolytes", "2026-09-22T13:20:00Z", "ade", { values_json: { sodium: 146, potassium: 5.1 } }),
  ],
  events: [
    { dog_id: "d1", kind: "note", started_at: "2026-10-16T18:40:00Z", ended_at: null, note: "Calm after grooming", recorded_by: "ade" },
    { dog_id: "d1", kind: "stressful_event", started_at: "2026-10-30T09:00:00Z", ended_at: null, note: "Kennels", recorded_by: "ade" },
    { dog_id: "d2", kind: "note", started_at: "2026-10-01T10:00:00Z", ended_at: null, note: "Another dog", recorded_by: "ade" },
  ],
  names: { ade: "Adebayo", sam: "Sam" },
};

const ledger = () => buildLedger({ data, dogId: "d1", from: "2026-09-17", to: "2026-10-17", timeZone: tz, packFor });

describe("buildLedger", () => {
  it("counts each kind of record in the month, with who made them", () => {
    const l = ledger();
    expect(l.days).toBe(31);
    expect(l.rows.map((r) => [r.mark, r.tile, r.count, r.label, r.sub])).toEqual([
      ["pred", "Pr", 4, "Doses ticked", "Prednisolone · Adebayo 2, Sam 2"],
      ["zyc", "Zy", 1, "Zycortal injection", "22 Sep · by Sam"],
      ["chk", null, 2, "Quick checks", "Adebayo 1, Sam 1"],
      ["meas", null, 3, "Weights", "Home scale 2, clinic scale 1"],
      ["meas", null, 1, "Lab report", "22 Sep · typed in by Adebayo"],
      ["note", null, 1, "Note", "Adebayo 1"],
    ]);
    expect(l.total).toBe(12);
  });

  it("reads each row as one sentence", () => {
    const [doses, injection, , weights, lab] = ledger().rows;
    expect(doses.sentence).toBe("4 doses of Prednisolone ticked: Adebayo 2, Sam 2.");
    expect(injection.sentence).toBe("1 Zycortal injection: 22 Sep, Sam.");
    expect(weights.sentence).toBe("3 weights: Home scale 2, clinic scale 1.");
    expect(lab.sentence).toBe("1 lab report: 22 Sep, typed in by Adebayo.");
  });

  it("tints each person's initial by who recorded most across the month", () => {
    const [doses] = ledger().rows;
    expect(doses.who.map((p) => [p.initial, p.tone])).toEqual([
      ["A", "a"],
      ["S", "s"],
    ]);
  });

  it("names the vet when they gave the injection", () => {
    const vet = { ...data, treatments: [tick("2026-09-22", null, { plan_item_id: "p2", slot: "injection", given_by: "Larkfield Vets" })] };
    const [row] = buildLedger({ data: vet, dogId: "d1", from: "2026-09-17", to: "2026-10-17", timeZone: tz, packFor }).rows;
    expect(row.sub).toBe("22 Sep · Larkfield Vets");
    expect(row.who).toEqual([]);
  });

  it("shows only what was recorded, never a row for what wasn't", () => {
    const quiet = { ...data, treatments: [tick("2026-09-17", "ade")], observations: [], events: [] };
    const l = buildLedger({ data: quiet, dogId: "d1", from: "2026-09-17", to: "2026-10-17", timeZone: tz, packFor });
    expect(l.rows.map((r) => r.label)).toEqual(["Dose ticked"]);
    expect(l.total).toBe(1);
    const words = /\b(missed|skipped|safe|normal|fine|streak|compliance|administer|dosage|good|bad|%)/i;
    expect(JSON.stringify(ledger())).not.toMatch(words);
  });
});
