import { describe, expect, it } from "vitest";
import { addMonths } from "./time";

describe("addMonths", () => {
  it("keeps the day of the month", () => {
    expect(addMonths("2026-10-10", 4)).toBe("2027-02-10");
  });

  it("uses the last day of a shorter month", () => {
    expect(addMonths("2026-10-31", 4)).toBe("2027-02-28");
    expect(addMonths("2027-10-31", 4)).toBe("2028-02-29");
  });

  it("crosses into the next year", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});
