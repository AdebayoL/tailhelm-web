import { describe, expect, it } from "vitest";
import addisons from "../../../packs/addisons.pack.json";
import { ConditionPack } from "@/packs/schema";
import { type ExportData, buildExportCsv, csvCell, exportFileName } from "./csv";

const pack = ConditionPack.parse(addisons);
const packFor = (key: string) => (key === "addisons" ? pack : null);
const electrolytes = pack.observationTypes.find((t) => t.key === "electrolytes")!;
const signs = pack.observationTypes.find((t) => t.key === "signs")!;

const data: ExportData = {
  dogs: [
    {
      id: "d1",
      name: "Bella",
      breed: "Collie",
      sex: "female",
      date_of_birth: null,
      vet_name: "Riverside Vets",
      vet_phone: "01632 960000",
      vet_email: null,
      out_of_hours_phone: null,
      insurance_ref: null,
      status: "active",
    },
  ],
  conditions: [{ id: "c1", dog_id: "d1", condition_key: "addisons", name: "Addison's disease", pack_version: "0.2.0", variant: "typical", diagnosed_on: "2026-03-01" }],
  planItems: [
    {
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
      created_at: "2026-09-12T10:00:00Z",
      created_by: "u1",
    },
  ],
  treatments: [
    {
      plan_item_id: "p1",
      given_at: "2026-10-10T07:05:00Z",
      given_on: "2026-10-10",
      slot: "08:00",
      extra_no: 0,
      amount: null,
      unit: null,
      given_by_profile: "u2",
      given_by: null,
      site: null,
      vial_id: null,
      note: null,
    },
  ],
  vials: [],
  observations: [
    {
      dog_condition_id: "c1",
      type_key: "electrolytes",
      taken_at: "2026-10-09T11:00:00Z",
      values_json: { [electrolytes.fields[0].key]: 140 },
      ranges_json: { [electrolytes.fields[0].key]: { low: 135, high: 155 } },
      derived_json: null,
      cycle_no: 2,
      days_since_anchor: 10,
      note: null,
      recorded_by: "u1",
      scale: null,
    },
    {
      dog_condition_id: "c1",
      type_key: "signs",
      taken_at: "2026-10-10T17:30:00Z",
      values_json: { [signs.fields[0].key]: true },
      ranges_json: null,
      derived_json: null,
      cycle_no: null,
      days_since_anchor: null,
      note: null,
      recorded_by: "u1",
      scale: null,
    },
    {
      dog_condition_id: "c1",
      type_key: "weight",
      taken_at: "2026-10-08T09:00:00Z",
      values_json: { kg: 24.6 },
      ranges_json: null,
      derived_json: null,
      cycle_no: null,
      days_since_anchor: null,
      note: null,
      recorded_by: "u1",
      scale: null,
    },
  ],
  events: [{ dog_id: "d1", kind: "note", started_at: "2026-10-10T19:00:00Z", ended_at: null, note: "=HYPERLINK(\"x\")", recorded_by: "u2" }],
  names: { u1: "Ade", u2: "Sam" },
};

const csv = buildExportCsv(data, "Europe/London", packFor);
const lines = csv.trim().split("\r\n");

describe("buildExportCsv", () => {
  it("starts with the header", () => {
    expect(lines[0]).toBe("Dog,Record,Date,Time,Item,Value,Unit,Details,Recorded by");
  });

  it("holds the dog, the condition and the plan as the owner typed it", () => {
    expect(lines).toContain("Bella,Dog,,,Vet,Riverside Vets,,,");
    expect(lines).toContain("Bella,Condition,2026-03-01,,Addison's disease,,,Variant: typical; Guidance version 0.2.0,");
    expect(lines.find((l) => l.includes(",Plan,"))).toMatch(/^Bella,Plan,2026-09-12,,Prednisolone 5 mg tablets,2\.5,mg,.*Date is when the vet set it,Ade$/);
  });

  it("holds each dose given in the owner's time zone with who gave it", () => {
    expect(lines).toContain("Bella,Given,2026-10-10,08:00,Prednisolone 5 mg tablets,,,,Sam");
  });

  it("holds results with the lab report range, quick checks and weights", () => {
    const label = electrolytes.fields[0];
    expect(lines).toContain(
      `Bella,${electrolytes.name},2026-10-09,12:00,${label.label},140,${label.unit},Lab report range 135 to 155; Day 10 after injection 2,Ade`,
    );
    expect(lines).toContain(`Bella,${signs.name},2026-10-10,18:30,Signs noticed,${signs.fields[0].label},,,Ade`);
    expect(lines).toContain("Bella,Weight,2026-10-08,10:00,Weight,24.6,kg,,Ade");
  });

  it("never lets a note run as a spreadsheet formula", () => {
    expect(lines).toContain(`Bella,Note,2026-10-10,20:00,,,,"'=HYPERLINK(""x"")",Sam`);
  });

  it("puts records in order: the dog, its condition, the plan, then by date", () => {
    expect(lines.map((l) => l.split(",")[1]).slice(1)).toEqual([
      "Dog",
      "Dog",
      "Dog",
      "Dog",
      "Dog",
      "Condition",
      "Plan",
      "Given",
      "Weight",
      electrolytes.name,
      signs.name,
      "Note",
    ]);
  });
});

describe("buildExportCsv with Happening now", () => {
  it("holds each capture with its start, how many seconds it ran and when it stopped", () => {
    const happening = (over: Partial<ExportData["events"][number]>) => ({
      dog_id: "d1",
      kind: "happening_now",
      started_at: "2026-10-14T23:58:00Z",
      ended_at: "2026-10-15T00:02:12Z",
      note: null,
      recorded_by: "u1",
      ...over,
    });
    const rows = buildExportCsv(
      { ...data, events: [happening({ note: "Wobbly after" }), happening({ started_at: "2026-10-16T09:00:00Z", ended_at: null })] },
      "Europe/London",
      packFor,
    ).split("\r\n");
    expect(rows).toContain("Bella,Happening now,2026-10-15,00:58,,252,seconds,Wobbly after; Stopped at 01:02,Ade");
    expect(rows).toContain("Bella,Happening now,2026-10-16,10:00,,,,Still running,Ade");
  });
});

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
  });

  it("defuses formulas", () => {
    expect(csvCell("+44 1632")).toBe("'+44 1632");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("exportFileName", () => {
  it("dates the file", () => {
    expect(exportFileName("2026-10-11")).toBe("tailhelm-export-2026-10-11.csv");
  });
});
