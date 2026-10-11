import { describe, expect, it } from "vitest";
import { describeWeight, parseWeightForm } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const fmt = (d: string) => `<${d}>`;

describe("parseWeightForm", () => {
  it("reads kilograms and the date", () => {
    expect(parseWeightForm(form({ taken_on: "2026-10-10", kg: "24.6" }), "2026-10-11")).toEqual({
      ok: true,
      value: { taken_on: "2026-10-10", kg: 24.6, note: null },
    });
  });

  it("accepts a decimal comma", () => {
    const r = parseWeightForm(form({ taken_on: "2026-10-11", kg: "8,25" }), "2026-10-11");
    expect(r.ok && r.value.kg).toBe(8.25);
  });

  it("refuses a future date, a missing weight and text", () => {
    const r = parseWeightForm(form({ taken_on: "2026-10-12", kg: "heavy" }), "2026-10-11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["kg", "taken_on"]);
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
