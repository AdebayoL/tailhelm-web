import { describe, expect, it } from "vitest";
import { initial, joinNames, otherNames, untilText } from "./words";

describe("words", () => {
  it("joins names the way people say them", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Sam"])).toBe("Sam");
    expect(joinNames(["Sam", "Kit"])).toBe("Sam and Kit");
    expect(joinNames(["Jo", "Kit", "Sam"])).toBe("Jo, Kit and Sam");
  });

  it("lists everyone in the household but me", () => {
    expect(otherNames({ me: "Adebayo", b: "Sam", c: "Kit" }, "me")).toEqual(["Kit", "Sam"]);
  });

  it("takes the first letter for an avatar", () => {
    expect(initial("bella")).toBe("B");
    expect(initial("  ")).toBe("?");
    expect(initial(null)).toBe("?");
  });

  it("says how far a dose time is from now", () => {
    const now = new Date("2026-10-11T16:20:00Z");
    expect(untilText(new Date("2026-10-11T17:00:00Z"), now)).toBe("in 40 min");
    expect(untilText(new Date("2026-10-12T01:05:00Z"), now)).toBe("in 8 h 45 min");
    expect(untilText(new Date("2026-10-11T18:20:00Z"), now)).toBe("in 2 h");
    expect(untilText(new Date("2026-10-11T16:18:00Z"), now)).toBe("now");
    expect(untilText(new Date("2026-10-11T15:40:00Z"), now)).toBe("due 40 min ago");
  });
});
