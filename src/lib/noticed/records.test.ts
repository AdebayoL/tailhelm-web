import { describe, expect, it } from "vitest";
import { getPack } from "@/packs/registry";
import { noticedInput, noticedTypeKeys } from "./records";

const pack = getPack("addisons");

describe("noticedInput", () => {
  const input = noticedInput({
    dogName: "Bella",
    pack,
    timeZone: "Europe/London",
    today: "2026-10-25",
    from: null,
    observations: [
      { id: "lab", type_key: "electrolytes", taken_at: "2026-10-20T11:00:00Z", values_json: { sodium: 140, potassium: 5.2 }, derived_json: { na_k_ratio: 26.9 } },
      // Saved at 23:30 UTC, which is the next day on a UK clock in summer time.
      { id: "check", type_key: "signs", taken_at: "2026-10-21T23:30:00Z", values_json: { vomiting: true, panting: false, weakness: true }, derived_json: null },
      { id: "weight", type_key: "weight", taken_at: "2026-10-22T09:00:00Z", values_json: { kg: 24.1 }, derived_json: null },
    ],
    events: [
      { id: "fireworks", kind: "stressful_event", note: "Fireworks", started_at: "2026-11-04T12:00:00Z", ended_at: "2026-11-06T12:00:00Z" },
      { id: "kennels", kind: "stressful_event", note: null, started_at: "2026-10-01T12:00:00Z", ended_at: null },
      { id: "now", kind: "happening_now", note: null, started_at: "2026-10-23T08:00:00Z", ended_at: "2026-10-23T08:02:30Z" },
      { id: "note", kind: "note", note: "Ate grass", started_at: "2026-10-23T08:00:00Z", ended_at: null },
    ],
    anchors: [{ anchored_on: "2026-10-01", cycle_no: 4 }],
  });

  it("reads the pack's lab fields and worked-out values", () => {
    expect(input.values.map((v) => [v.key, v.label, v.unit, v.value, v.derived])).toEqual([
      ["sodium", "Sodium", "mmol/L", 140, false],
      ["potassium", "Potassium", "mmol/L", 5.2, false],
      ["na_k_ratio", "Na:K ratio", null, 26.9, true],
    ]);
  });

  it("reads each quick check and the signs ticked on it, on the owner's clock", () => {
    expect(input.checks).toEqual([{ id: "check", on: "2026-10-22", text: "Quick check" }]);
    expect(input.signs.map((s) => [s.on, s.key])).toEqual([
      ["2026-10-22", "vomiting"],
      ["2026-10-22", "weakness"],
    ]);
  });

  it("leaves out weights, notes and anything the pack does not list", () => {
    expect(input.values.some((v) => v.key === "kg")).toBe(false);
    expect(noticedTypeKeys(pack)).toEqual(["electrolytes", "signs"]);
  });

  it("gives a stressful event a day for each day it covers", () => {
    expect(input.stress.map((s) => [s.on, s.text])).toEqual([
      ["2026-11-04", "Fireworks"],
      ["2026-11-05", "Fireworks"],
      ["2026-11-06", "Fireworks"],
      ["2026-10-01", "Stressful day"],
    ]);
  });

  it("reads Happening now records and the injection cycles", () => {
    expect(input.happenings).toEqual([{ id: "now", on: "2026-10-23", text: "Happening now, 2 min 30 s" }]);
    expect(input.anchors).toEqual([{ on: "2026-10-01", cycleNo: 4 }]);
  });
});
