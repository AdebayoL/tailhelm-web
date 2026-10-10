import { describe, expect, it } from "vitest";
import type { PlanSchedule } from "@/engine/schedule";
import { describePlanItem, formatDate, parseConditionForm, parsePlanItemForm } from "./input";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage)\b/i;

function form(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const steroid = {
  pack_key: "glucocorticoid",
  product: "Prednisolone",
  strength: "5 mg tablets",
  dose_amount: "2.5",
  dose_unit: "mg",
  times: ["08:00", ""],
  set_by_vet_on: "2026-09-12",
};

describe("parseConditionForm", () => {
  it("accepts a variant the pack lists", () => {
    const r = parseConditionForm(form({ condition_key: "addisons", variant: "atypical", diagnosed_on: "" }));
    expect(r).toEqual({ ok: true, value: { condition_key: "addisons", variant: "atypical", diagnosed_on: null } });
  });

  it("refuses an unknown condition, an unknown variant and a future diagnosis", () => {
    expect(parseConditionForm(form({ condition_key: "nope" })).ok).toBe(false);
    const r = parseConditionForm(form({ condition_key: "addisons", variant: "mild", diagnosed_on: "2999-01-01" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["diagnosed_on", "variant"]);
  });
});

describe("parsePlanItemForm", () => {
  it("keeps the amount, unit and times exactly as typed", () => {
    const r = parsePlanItemForm(form(steroid), "addisons", "typical");
    expect(r).toEqual({
      ok: true,
      value: {
        pack_key: "glucocorticoid",
        kind: "medicine",
        product: "Prednisolone",
        strength: "5 mg tablets",
        dose_amount: 2.5,
        dose_unit: "mg",
        schedule_kind: "fixed",
        schedule_json: { kind: "fixed", times: ["08:00"] },
        usual_times: ["08:00"],
        set_by_vet_on: "2026-09-12",
        vet_instructions: null,
      },
    });
  });

  it("sorts and de-duplicates times", () => {
    const r = parsePlanItemForm(form({ ...steroid, times: ["20:00", "08:00", "08:00"] }), "addisons", "typical");
    expect(r.ok && r.value.schedule_json).toEqual({ kind: "fixed", times: ["08:00", "20:00"] });
  });

  it("reads an interval medicine's days and reminder time", () => {
    const r = parsePlanItemForm(
      form({ ...steroid, pack_key: "docp", product: "Zycortal", dose_amount: "0.9", dose_unit: "mL", every_days: "28", time: "09:00" }),
      "addisons",
      "typical",
    );
    expect(r.ok && r.value.schedule_json).toEqual({ kind: "interval", everyDays: 28, time: "09:00" });
    expect(r.ok && r.value.usual_times).toEqual(["09:00"]);
  });

  it("offers only the medicines the pack lists for the dog's variant", () => {
    const r = parsePlanItemForm(form({ ...steroid, pack_key: "docp", every_days: "28", time: "09:00" }), "addisons", "atypical");
    expect(r).toEqual({ ok: false, errors: { pack_key: "Choose what to add." } });
  });

  it("needs an amount, a unit, a date the vet set it and a time", () => {
    const r = parsePlanItemForm(
      form({ ...steroid, product: "", dose_amount: "two", dose_unit: "spoonfuls", set_by_vet_on: "", times: [] }),
      "addisons",
      "typical",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["dose_amount", "dose_unit", "product", "set_by_vet_on", "times"]);
    }
  });

  it("reads the blood-test days the vet set, with no amount", () => {
    const r = parsePlanItemForm(
      form({ pack_key: "electrolytes_after_injection", offsets_days: "25, 10 and 10", time: "09:00", set_by_vet_on: "2026-09-12", dose_amount: "5" }),
      "addisons",
      "typical",
    );
    expect(r).toEqual({
      ok: true,
      value: {
        pack_key: "electrolytes_after_injection",
        kind: "observation",
        product: "Sodium and potassium blood test",
        strength: null,
        dose_amount: null,
        dose_unit: null,
        schedule_kind: "offset",
        schedule_json: { kind: "offset", offsetsDays: [10, 25], time: "09:00" },
        usual_times: ["09:00"],
        set_by_vet_on: "2026-09-12",
        vet_instructions: null,
      },
    });
  });

  it("needs the blood-test days, a reminder time and the date the vet asked", () => {
    for (const offsets_days of ["", "ten", "0", "400", "10.5"]) {
      const r = parsePlanItemForm(form({ pack_key: "electrolytes_after_injection", offsets_days, time: "", set_by_vet_on: "" }), "addisons", "typical");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["offsets_days", "set_by_vet_on", "time"]);
    }
  });

  it("refuses zero, negative and over-precise amounts", () => {
    for (const dose_amount of ["0", "-1", "1.2345", "1e3"]) {
      expect(parsePlanItemForm(form({ ...steroid, dose_amount }), "addisons", "typical").ok).toBe(false);
    }
  });
});

describe("describePlanItem", () => {
  it("reads back exactly what was entered", () => {
    expect(
      describePlanItem({
        product: "Prednisolone",
        strength: "5 mg tablets",
        dose_amount: 2.5,
        dose_unit: "mg",
        schedule_json: { kind: "fixed", times: ["08:00", "20:00"] },
        set_by_vet_on: "2026-09-12",
      }),
    ).toBe("Prednisolone 5 mg tablets, 2.5 mg twice a day at 08:00 and 20:00 (set by vet 12 Sep 2026)");
    expect(
      describePlanItem({
        product: "Zycortal",
        strength: null,
        dose_amount: 0.9,
        dose_unit: "mL",
        schedule_json: { kind: "interval", everyDays: 28, time: "09:00" },
        set_by_vet_on: "2026-09-01",
      }),
    ).toBe("Zycortal, 0.9 mL every 28 days, reminder at 09:00 (set by vet 1 Sep 2026)");
  });

  it("never uses the words Tailhelm avoids", () => {
    const schedules = [
      { kind: "fixed", times: ["08:00"] },
      { kind: "interval", everyDays: 28, time: "09:00" },
      { kind: "offset", offsetsDays: [10, 25], time: "09:00" },
      { kind: "series", everyMinutes: 120, readings: 6 },
      { kind: "event" },
    ] satisfies PlanSchedule[];
    for (const schedule_json of schedules) {
      const text = describePlanItem({ product: "X", strength: null, dose_amount: 1, dose_unit: "mg", schedule_json, set_by_vet_on: "2026-01-01" });
      expect(text).not.toMatch(BANNED);
    }
  });
});

it("formats dates the UK way", () => {
  expect(formatDate("2026-01-05")).toBe("5 Jan 2026");
});
