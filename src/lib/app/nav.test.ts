import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/auth/input";
import { EMERGENCY_PATH, TABS, tabFor } from "./nav";

const BANNED = ["safe", "normal", "fine", "streak", "compliance", "administer", "dosage"];

describe("navigation", () => {
  it("has the four tabs from the spec, in order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Today", "Trends", "Care team", "Dog"]);
  });

  it("keeps every tab and the emergency screen behind sign-in", () => {
    for (const path of [...TABS.map((t) => t.href), EMERGENCY_PATH]) {
      expect(isProtectedPath(path)).toBe(true);
    }
  });

  it("marks the tab a path belongs to", () => {
    expect(tabFor("/today")?.label).toBe("Today");
    expect(tabFor("/dog/plan")?.label).toBe("Dog");
    expect(tabFor("/dogs")).toBeNull();
    expect(tabFor(EMERGENCY_PATH)).toBeNull();
  });

  it("uses none of the banned words", () => {
    const text = TABS.flatMap((t) => [t.label, t.question]).join(" ").toLowerCase();
    for (const word of BANNED) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});
