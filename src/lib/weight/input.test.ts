import { describe, expect, it } from "vitest";
import { describeWeight, kgFigure, parseWeightForm, vetWeight } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const fmt = (d: string) => `<${d}>`;

describe("parseWeightForm", () => {
  it("reads kilograms, the date and whose scale", () => {
    expect(parseWeightForm(form({ taken_on: "2026-10-10", kg: "24.6", scale: "clinic" }), "2026-10-11")).toEqual({
      ok: true,
      value: { taken_on: "2026-10-10", kg: 24.6, scale: "clinic", note: null },
    });
  });

  it("accepts a decimal comma", () => {
    const r = parseWeightForm(form({ taken_on: "2026-10-11", kg: "8,25", scale: "home" }), "2026-10-11");
    expect(r.ok && r.value.kg).toBe(8.25);
  });

  it("refuses a future date, a missing weight, text and an unknown scale", () => {
    const r = parseWeightForm(form({ taken_on: "2026-10-12", kg: "heavy", scale: "bathroom" }), "2026-10-11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["kg", "scale", "taken_on"]);
  });

  it("refuses zero and implausible weights", () => {
    expect(parseWeightForm(form({ taken_on: "2026-10-11", kg: "0" }), "2026-10-11").ok).toBe(false);
    expect(parseWeightForm(form({ taken_on: "2026-10-11", kg: "250" }), "2026-10-11").ok).toBe(false);
  });
});

describe("describeWeight", () => {
  it("states the first weight alone", () => {
    expect(describeWeight(24.6, null, fmt)).toBe("24.6 kg.");
  });

  it("states the change since the weight before, with no judgement", () => {
    expect(describeWeight(24.6, { kg: 24.2, on: "2026-10-03" }, fmt)).toBe("24.6 kg, up 0.4 kg since <2026-10-03>.");
    expect(describeWeight(23.95, { kg: 24.2, on: "2026-10-03" }, fmt)).toBe("23.95 kg, down 0.25 kg since <2026-10-03>.");
    expect(describeWeight(24.2, { kg: 24.2, on: "2026-10-03" }, fmt)).toBe("24.2 kg, the same as on <2026-10-03>.");
  });
});

it("writes kilograms to one decimal place, or two when given", () => {
  expect(kgFigure(24)).toBe("24.0");
  expect(kgFigure(24.6)).toBe("24.6");
  expect(kgFigure(8.25)).toBe("8.25");
});

it("gives a vet the latest clinic weight first", () => {
  const weights = [
    { kg: 24.3, scale: "home" as const, on: "2026-10-04" },
    { kg: 24.6, scale: "clinic" as const, on: "2026-09-22" },
  ];
  expect(vetWeight(weights, fmt)).toEqual({ kg: "24.6 kg", where: "at clinic, <2026-09-22>", text: "24.6 kg at clinic, <2026-09-22>" });
  expect(vetWeight(weights.slice(0, 1), fmt)?.text).toBe("24.3 kg on home scale, <2026-10-04>");
  expect(vetWeight([{ kg: 24, scale: null, on: "2026-10-04" }], fmt)?.text).toBe("24.0 kg, <2026-10-04>");
  expect(vetWeight([], fmt)).toBeNull();
});
