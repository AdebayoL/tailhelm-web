import { describe, expect, it } from "vitest";
import { cycleView, jewelClass, jewelOf, tileLetters } from "./jewel";

const fmt = (d: string) => (d === "2026-10-20" ? "20 Oct" : d);

describe("jewelOf", () => {
  it("colours by what the record is about", () => {
    expect(jewelOf({ kind: "fixed" })).toBe("pred");
    expect(jewelOf({ kind: "event" })).toBe("pred");
    expect(jewelOf({ kind: "interval" })).toBe("zyc");
    expect(jewelOf({ kind: "offset" })).toBe("meas");
    expect(jewelClass({ kind: "interval" })).toBe("m-zyc");
  });
});

describe("tileLetters", () => {
  it("takes the first two letters", () => {
    expect(tileLetters("Prednisolone")).toBe("Pr");
    expect(tileLetters("zycortal")).toBe("Zy");
    expect(tileLetters("5 mg tablets")).toBe("Mg");
    expect(tileLetters("")).toBe("");
  });
});

describe("cycleView", () => {
  it("states the day of the cycle as the design writes it", () => {
    expect(cycleView("Zycortal", { dueOn: "2026-10-20", daysUntil: 9 }, 28, fmt)).toEqual({
      line: "Zycortal in 9 days · day 19 of 28",
      day: 19,
      overdue: false,
      label: "Zycortal cycle: day 19 of 28",
      fullLabel: "Zycortal cycle: day 19 of 28",
    });
    expect(cycleView("Zycortal", { dueOn: "2026-10-20", daysUntil: 1 }, 28, fmt)?.line).toBe("Zycortal in 1 day · day 27 of 28");
    expect(cycleView("Zycortal", { dueOn: "2026-10-20", daysUntil: 0 }, 28, fmt)?.line).toBe("Zycortal due today · day 28 of 28");
  });

  it("gives the due date once every day has passed", () => {
    const v = cycleView("Zycortal", { dueOn: "2026-10-20", daysUntil: -2 }, 28, fmt);
    expect(v?.line).toBe("Zycortal was due on 20 Oct");
    expect(v?.overdue).toBe(true);
    expect(v?.fullLabel).toBe("Zycortal cycle: all 28 days passed, injection due 20 Oct");
  });

  it("is empty until the first injection is recorded", () => {
    expect(cycleView("Zycortal", { dueOn: null, daysUntil: null }, 28, fmt)).toBeNull();
  });
});
