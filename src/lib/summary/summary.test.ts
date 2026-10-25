import { describe, expect, it } from "vitest";
import addisons from "../../../packs/addisons.pack.json";
import type { ExportData, ExportPlanItem, ExportTreatment } from "@/lib/export/csv";
import { ConditionPack } from "@/packs/schema";
import { buildSummary, summaryFileName, summaryText } from "./summary";

const pack = ConditionPack.parse(addisons);
const packFor = (key: string) => (key === "addisons" ? pack : null);
const now = new Date("2026-10-17T18:30:00Z"); // 19:30 in London
const tz = "Europe/London";

const item = (over: Partial<ExportPlanItem>): ExportPlanItem => ({
  id: "p1",
  dog_condition_id: "c1",
  product: "Prednisolone",
  strength: "5 mg tablets",
  dose_amount: 2.5,
  dose_unit: "mg",
  schedule_json: { kind: "fixed", times: ["08:00"] },
  set_by_vet_on: "2026-09-12",
  vet_instructions: null,
  active: true,
  supersedes_id: null,
  created_at: "2026-10-12T09:00:00Z",
  created_by: "u1",
  ...over,
});

const tick = (on: string, over: Partial<ExportTreatment> = {}): ExportTreatment => ({
  plan_item_id: "p1",
  given_at: `${on}T07:05:00Z`,
  given_on: on,
  slot: "08:00",
  extra_no: 0,
  amount: null,
  unit: null,
  given_by_profile: "u2",
  given_by: null,
  site: null,
  vial_id: null,
  note: null,
  ...over,
});

const observation = { ranges_json: null, derived_json: null, cycle_no: null, days_since_anchor: null, note: null, recorded_by: "u1", scale: null };

const data: ExportData = {
  dogs: [
    {
      id: "d1",
      name: "Bella",
      breed: "Collie",
      sex: "female",
      date_of_birth: "2019-03-14",
      vet_name: "Riverside Vets",
      vet_phone: "01632 960000",
      vet_email: null,
      out_of_hours_phone: "01632 960999",
      insurance_ref: null,
      status: "active",
      noticed_off: false,
    },
    { id: "d2", name: "Rex", breed: null, sex: null, date_of_birth: null, vet_name: null, vet_phone: null, vet_email: null, out_of_hours_phone: null, insurance_ref: null, status: "active", noticed_off: false },
  ],
  conditions: [
    { id: "c1", dog_id: "d1", condition_key: "addisons", name: "Addison's disease", pack_version: "0.2.0", variant: "typical", diagnosed_on: "2026-03-01" },
    { id: "c2", dog_id: "d2", condition_key: "addisons", name: "Addison's disease", pack_version: "0.2.0", variant: null, diagnosed_on: null },
  ],
  planItems: [
    // The vet lowered the steroid on 12 Oct: the new item replaced the old one.
    item({ id: "p0", dose_amount: 5, active: false, set_by_vet_on: "2026-03-01", created_at: "2026-03-02T09:00:00Z" }),
    item({ id: "p1", supersedes_id: "p0", vet_instructions: "Give with food." }),
    item({
      id: "p2",
      product: "Zycortal",
      strength: "25 mg/ml",
      dose_amount: 1.1,
      dose_unit: "ml",
      schedule_json: { kind: "interval", everyDays: 28, time: "09:00" },
      set_by_vet_on: "2026-03-01",
      created_at: "2026-03-02T09:00:00Z",
    }),
    item({ id: "p9", dog_condition_id: "c2", product: "Not Bella's", created_at: "2026-10-01T09:00:00Z" }),
  ],
  treatments: [
    tick("2026-10-01", { plan_item_id: "p0" }),
    tick("2026-10-13"),
    tick("2026-10-14"),
    tick("2026-10-16"),
    tick("2026-10-16", { extra_no: 1, given_at: "2026-10-16T13:20:00Z", amount: 2.5, unit: "mg", note: "Fireworks next door" }),
    tick("2026-10-05", { plan_item_id: "p2", slot: "injection", amount: 1.1, unit: "ml", site: "left shoulder", given_by: "Riverside Vets", given_by_profile: null, vial_id: "v1" }),
    tick("2026-07-01", { plan_item_id: "p2", slot: "injection", amount: 1.1, unit: "ml" }),
    tick("2026-10-15", { plan_item_id: "p9" }),
  ],
  vials: [{ id: "v1", plan_item_id: "p2", batch: "AB123", expires_on: "2027-06-30", opened_on: "2026-10-05" }],
  observations: [
    {
      ...observation,
      dog_condition_id: "c1",
      type_key: "electrolytes",
      taken_at: "2026-10-09T11:00:00Z",
      values_json: { sodium: 142, potassium: 5.1 },
      ranges_json: { sodium: { low: 139, high: 154 }, potassium: { low: 3.6, high: 5.0 } },
      derived_json: { na_k_ratio: 27.843 },
      cycle_no: 4,
      days_since_anchor: 4,
    },
    { ...observation, dog_condition_id: "c1", type_key: "weight", taken_at: "2026-10-08T09:00:00Z", values_json: { kg: 24.6 }, scale: "clinic" },
    { ...observation, dog_condition_id: "c1", type_key: "weight", taken_at: "2026-06-01T09:00:00Z", values_json: { kg: 22 }, scale: "home" },
    { ...observation, dog_condition_id: "c1", type_key: "signs", taken_at: "2026-10-10T17:30:00Z", values_json: { vomiting: true, lethargy: true } },
    { ...observation, dog_condition_id: "c1", type_key: "signs", taken_at: "2026-10-11T17:30:00Z", values_json: { vomiting: false } },
  ],
  events: [
    { dog_id: "d1", kind: "stressful_event", started_at: "2026-11-05T17:00:00Z", ended_at: null, note: "Bonfire night", recorded_by: "u1" },
    { dog_id: "d1", kind: "stressful_event", started_at: "2026-10-15T09:00:00Z", ended_at: "2026-10-16T18:00:00Z", note: "Kennels", recorded_by: "u2" },
    { dog_id: "d1", kind: "happening_now", started_at: "2026-10-14T02:12:00Z", ended_at: "2026-10-14T02:16:12Z", note: "Wobbly after", recorded_by: "u1" },
    { dog_id: "d1", kind: "note", started_at: "2026-10-12T10:00:00Z", ended_at: null, note: "Slower on the walk.", recorded_by: "u2" },
    { dog_id: "d1", kind: "note", started_at: "2026-05-01T10:00:00Z", ended_at: null, note: "From the spring.", recorded_by: "u2" },
  ],
  noticed: [],
  names: { u1: "Adebayo", u2: "Sam" },
};

const text = () => summaryText(buildSummary({ data, dogId: "d1", timeZone: tz, now, packFor })!);

describe("buildSummary", () => {
  it("opens with the dog, the 90 days it covers and who to call", () => {
    const t = text();
    expect(t).toContain("# Bella: 90-day summary");
    expect(t).toContain("20 Jul 2026 to 17 Oct 2026. Prepared Sat 17 Oct 2026, 19:30.");
    expect(t).toContain("Collie · female · born March 2019");
    expect(t).toContain("Condition: Addison's disease (hypoadrenocorticism), typical, diagnosed 1 Mar 2026");
    expect(t).toContain("Usual vet: Riverside Vets, 01632 960000");
    expect(t).toContain("Out-of-hours vet: 01632 960999");
  });

  it("gives the plan exactly as typed, with the date the vet set it, and the change made in the period", () => {
    const t = text();
    expect(t).toContain("Prednisolone 5 mg tablets: 2.5 mg, once daily at 08:00. Set by the vet on 12 Sep 2026.");
    expect(t).toContain("  Vet's instructions: Give with food.");
    expect(t).toContain("Zycortal 25 mg/ml: 1.1 ml, every 28 days, reminder at 09:00. Set by the vet on 1 Mar 2026.");
    expect(t).toContain("12 Oct 2026: now Prednisolone 5 mg tablets, 2.5 mg once daily at 08:00 (set by vet 12 Sep 2026).");
    expect(t).toContain("  Before: Prednisolone 5 mg tablets, 5 mg once daily at 08:00 (set by vet 1 Mar 2026).");
    expect(t).not.toContain("Not Bella's");
  });

  it("counts ticks on whole days and lists each extra dose as recorded", () => {
    const t = text();
    expect(t).toContain("Prednisolone 5 mg tablets: 3 ticks on 3 days.");
    // Added on 12 Oct, so 13 to 16 Oct are the whole days; today is still open.
    expect(t).toContain("  13 Oct 2026 to 16 Oct 2026: no tick on 1 of the 4 days: 15 Oct 2026.");
    expect(t).toContain("  Extra dose 16 Oct 2026, 14:20: 2.5 mg, ticked by Sam, Fireworks next door");
    expect(t).toContain("Prednisolone 5 mg tablets (no longer on the plan): 1 tick on 1 day.");
  });

  it("lists injections in the period with amount, site, who and vial", () => {
    const t = text();
    expect(t).toContain("Zycortal 25 mg/ml: 1 injection recorded.");
    expect(t).toContain("  5 Oct 2026: 1.1 ml, site: left shoulder, given by Riverside Vets, vial batch AB123");
    expect(t).not.toContain("1 Jul 2026");
  });

  it("states each lab result against the range on the owner's own report, and nothing more", () => {
    const t = text();
    expect(t).toContain("Sodium and potassium blood test, 9 Oct 2026. Day 4 after injection 4.");
    expect(t).toContain("  Sodium 142 mmol/L: inside the range on the lab report (139–154)");
    expect(t).toContain("  Potassium 5.1 mmol/L: outside the range on the lab report (3.6–5)");
    expect(t).toContain("  Na:K ratio 27.8");
    expect(t).toContain("8 Oct 2026: 24.6 kg, clinic scale, entered by Adebayo");
    expect(t).not.toContain("22.0 kg");
  });

  it("gives signs, stressful days, Happening now and notes from the period only", () => {
    const t = text();
    expect(t).toContain("Checks saved on 2 days, with signs ticked on 1 of them.");
    expect(t).toContain("  10 Oct 2026: Less energy than usual, Vomiting");
    expect(t).toContain("15 Oct 2026 to 16 Oct 2026: Stressful day: Kennels. Entered by Sam.");
    expect(t).toContain("14 Oct 2026, 03:12: Happening now, 4 min 12 s: Wobbly after. Started by Adebayo.");
    expect(t).not.toContain("Bonfire night");
    expect(t).toContain("12 Oct 2026, Sam: Slower on the walk.");
    expect(t).not.toContain("From the spring.");
  });

  it("never judges the dog's health, suggests anything but the vet, or works out a dose", () => {
    const words = /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad|better|worse|should)\b/i;
    expect(text()).not.toMatch(words);
    expect(text()).toContain("Tailhelm never works one out");
    // The only amounts are the ones typed in.
    const amounts = [...text().matchAll(/(\d+(?:\.\d+)?) (?:mg|ml)\b/g)].map((m) => m[1]);
    expect(new Set(amounts)).toEqual(new Set(["5", "2.5", "25", "1.1"]));
  });

  it("says plainly when nothing was recorded", () => {
    const t = summaryText(buildSummary({ data, dogId: "d2", timeZone: tz, now, packFor })!);
    expect(t).toContain("Condition: Addison's disease (hypoadrenocorticism), diagnosis date not entered");
    expect(t).toContain("No lab reports entered.");
    expect(t).toContain("No weights entered.");
    expect(t).toContain("No checks saved.");
    expect(t).toContain("No notes.");
  });

  it("lists what Noticed found that the household added, and nothing else of it", () => {
    const n = (over: Partial<ExportData["noticed"][number]>): ExportData["noticed"][number] => ({
      dog_id: "d1",
      rule_family: "direction",
      computed_on: "2026-10-11",
      window_start: "2026-09-20",
      window_end: "2026-10-11",
      copy: "Bella’s Na:K ratio has fallen across the last 3 results: 30.1 on 20 Sep, 28.4 on 1 Oct and 27.2 on 8 Oct.",
      dismissed_at: null,
      added_to_report_at: "2026-10-11T08:00:00Z",
      added_by: "u2",
      ...over,
    });
    const noticed = [n({}), n({ copy: "Not added.", added_to_report_at: null, added_by: null }), n({ copy: "Dismissed.", dismissed_at: "2026-10-12T08:00:00Z" })];
    const t = summaryText(buildSummary({ data: { ...data, noticed }, dogId: "d1", timeZone: tz, now, packFor })!);
    expect(t).toContain("## Noticed");
    expect(t).toContain(
      "11 Oct 2026: Bella’s Na:K ratio has fallen across the last 3 results: 30.1 on 20 Sep, 28.4 on 1 Oct and 27.2 on 8 Oct. Added by Sam.",
    );
    expect(t).not.toContain("Not added.");
    expect(t).not.toContain("Dismissed.");
    expect(t).toContain("it is not a clinical finding");
    expect(t).not.toMatch(/\b(safe|normal|fine|good|bad|better|worse|should)\b/i);

    const off = { ...data, noticed, dogs: data.dogs.map((d) => ({ ...d, noticed_off: true })) };
    expect(summaryText(buildSummary({ data: off, dogId: "d1", timeZone: tz, now, packFor })!)).not.toContain("## Noticed");
    expect(text()).not.toContain("## Noticed");
  });

  it("is only for a dog in the household", () => {
    expect(buildSummary({ data, dogId: "someone-else", timeZone: tz, now, packFor })).toBeNull();
  });

  it("names the file by the day it was made", () => {
    expect(summaryFileName("2026-10-17")).toBe("tailhelm-90-day-summary-2026-10-17.pdf");
  });
});
