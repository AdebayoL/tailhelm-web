import { describe, expect, it } from "vitest";
import { getPack } from "@/packs/registry";
import { deriveValues, describeValue, parseResultForm, rangeStatus, resultTypes } from "./input";

const BANNED = /\b(safe|normal|fine|good|bad|healthy|low|high)\b/i;
const pack = getPack("addisons");
const electrolytes = resultTypes(pack)[0];

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const typed = {
  taken_on: "2026-10-11",
  sodium: "145",
  potassium: "5.6",
  sodium_low: "139",
  sodium_high: "154",
  potassium_low: "3.6",
  potassium_high: "5.5",
};

describe("resultTypes", () => {
  it("offers only the pack's lab results, not the signs checklist", () => {
    expect(resultTypes(pack).map((t) => t.key)).toEqual(["electrolytes"]);
    expect(electrolytes.fields.map((f) => `${f.label} ${f.unit}`)).toEqual(["Sodium mmol/L", "Potassium mmol/L"]);
  });
});

describe("parseResultForm", () => {
  it("keeps the values and the ranges from the lab report as typed", () => {
    expect(parseResultForm(form(typed), electrolytes, "2026-10-11")).toEqual({
      ok: true,
      value: {
        type_key: "electrolytes",
        taken_on: "2026-10-11",
        values: { sodium: 145, potassium: 5.6 },
        ranges: { sodium: { low: 139, high: 154 }, potassium: { low: 3.6, high: 5.5 } },
        note: null,
      },
    });
  });

  it("lets the ranges be left blank", () => {
    const r = parseResultForm(form({ taken_on: "2026-10-11", sodium: "145", potassium: "5.6" }), electrolytes, "2026-10-11");
    expect(r.ok && r.value.ranges).toEqual({});
  });

  it("needs each value, a past date, and a whole range the right way round", () => {
    const r = parseResultForm(
      form({ ...typed, taken_on: "2026-10-12", sodium: "", potassium: "lots", sodium_low: "154", potassium_high: "" }),
      electrolytes,
      "2026-10-11",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["potassium", "potassium_range", "sodium", "sodium_range", "taken_on"]);
  });
});

describe("deriveValues", () => {
  it("works out the Na:K ratio the pack defines, to one decimal place", () => {
    expect(deriveValues(pack, "electrolytes", { sodium: 145, potassium: 5.6 })).toEqual([
      { key: "na_k_ratio", name: "Na:K ratio", value: 25.9 },
    ]);
  });

  it("gives nothing for a missing value", () => {
    expect(deriveValues(pack, "electrolytes", { sodium: 145 })).toEqual([]);
  });
});

describe("against the owner's lab range", () => {
  it("includes both ends of the range", () => {
    expect(rangeStatus(3.6, { low: 3.6, high: 5.5 })).toBe("inside");
    expect(rangeStatus(5.5, { low: 3.6, high: 5.5 })).toBe("inside");
    expect(rangeStatus(5.6, { low: 3.6, high: 5.5 })).toBe("outside");
    expect(rangeStatus(5.6, undefined)).toBeNull();
  });

  it("states the numbers and points only to the vet", () => {
    const [sodium, potassium] = electrolytes.fields;
    const lines = [
      describeValue(sodium, 145, { low: 139, high: 154 }),
      describeValue(potassium, 5.6, { low: 3.6, high: 5.5 }),
      describeValue(potassium, 5.6, undefined),
    ];
    expect(lines).toEqual([
      "Sodium 145 mmol/L, inside the range on your lab report (139 to 154).",
      "Potassium 5.6 mmol/L, outside the range on your lab report (3.6 to 5.5), ask your vet.",
      "Potassium 5.6 mmol/L.",
    ]);
    for (const l of lines) expect(l).not.toMatch(BANNED);
  });
});
