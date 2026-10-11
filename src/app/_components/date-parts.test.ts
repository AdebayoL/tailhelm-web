import { describe, expect, it } from "vitest";
import { joinDateParts } from "./date-parts";

describe("joinDateParts", () => {
  it("joins the three boxes into one date", () => {
    expect(joinDateParts("12", "9", "2026")).toBe("2026-09-12");
    expect(joinDateParts(" 1", "01 ", "2026")).toBe("2026-01-01");
  });

  it("is empty when nothing was typed, so an optional date can be left out", () => {
    expect(joinDateParts("", "", "")).toBe("");
  });

  it("gives the parser something to refuse when a box is missing", () => {
    expect(joinDateParts("", "9", "2026")).toBe("incomplete");
    expect(joinDateParts("12", "9", "26")).toBe("incomplete");
  });
});
