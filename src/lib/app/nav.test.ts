import { describe, expect, it } from "vitest";
import { isProtectedPath } from "@/lib/auth/input";
import { EMERGENCY_PATH, MORE, TABS, dogTabLabel, sideItemFor, tabFor } from "./nav";

const BANNED = ["safe", "normal", "fine", "streak", "compliance", "administer", "dosage"];

describe("navigation", () => {
  it("has the four tabs from the spec, in order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Today", "Trends", "Care team", "Dog"]);
  });

  it("keeps every tab, the Dog tab's screens and the emergency screen behind sign-in", () => {
    for (const path of [...TABS.map((t) => t.href), ...MORE.map((m) => m.href), EMERGENCY_PATH]) {
      expect(isProtectedPath(path)).toBe(true);
    }
  });

  it("marks the tab a path belongs to", () => {
    expect(tabFor("/today")?.label).toBe("Today");
    expect(tabFor("/dog/plan")?.label).toBe("Dog");
    expect(tabFor("/dogs")).toBeNull();
    expect(tabFor(EMERGENCY_PATH)).toBeNull();
    // A Happening now record's detail belongs to Today.
    expect(tabFor("/happening-now/0f1c")?.label).toBe("Today");
    expect(sideItemFor("/happening-now/0f1c")).toBe("/today");
  });

  it("counts the vet visit and reminders as the Dog tab on a phone, and as their own items in the sidebar", () => {
    expect(tabFor("/reminders")?.label).toBe("Dog");
    expect(tabFor("/vet-visit")?.label).toBe("Dog");
    expect(sideItemFor("/reminders")).toBe("/reminders");
    expect(sideItemFor("/trends")).toBe("/trends");
    expect(sideItemFor(EMERGENCY_PATH)).toBeNull();
  });

  it("uses none of the banned words", () => {
    const text = [...TABS.flatMap((t) => [t.label, t.question]), ...MORE.map((m) => m.label)].join(" ").toLowerCase();
    for (const word of BANNED) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  });

  it("calls the Dog tab by the dog's name when there is one dog, and Dogs when there are several", () => {
    expect(dogTabLabel([])).toBe("Dog");
    expect(dogTabLabel(["Buster"])).toBe("Buster");
    expect(dogTabLabel([" Buster "])).toBe("Buster");
    expect(dogTabLabel(["Buster", "Bella"])).toBe("Dogs");
  });
});
