import { describe, expect, it } from "vitest";
import { FREE_DAYS, historyStart } from "./window";

describe("historyStart", () => {
  it("reaches back 30 days including today on free", () => {
    expect(FREE_DAYS).toBe(30);
    expect(historyStart("2026-10-17", false)).toBe("2026-09-18");
    expect(historyStart("2026-03-01", false)).toBe("2026-01-31");
  });

  it("reaches back to the first record on Plus", () => {
    expect(historyStart("2026-10-17", true)).toBeNull();
  });
});
