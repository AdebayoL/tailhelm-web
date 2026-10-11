import { describe, expect, it } from "vitest";
import { cycleCells, dayPercent, firstDoseOn } from "./view";

describe("dayPercent", () => {
  it("places a time on the 24-hour rail", () => {
    expect(dayPercent("00:00")).toBe(0);
    expect(dayPercent("06:00")).toBe(25);
    expect(dayPercent("18:00")).toBe(75);
  });
});

describe("firstDoseOn", () => {
  const items = [
    { id: "a", product: "Prednisolone", schedule_json: { kind: "fixed" as const, times: ["18:00", "08:00"] } },
    { id: "b", product: "Zycortal", schedule_json: { kind: "interval" as const, everyDays: 28, time: "09:00" } },
    { id: "c", product: "Fludrocortisone", schedule_json: { kind: "fixed" as const, times: ["07:30"] } },
  ];

  it("finds the earliest dose of the day across medicines", () => {
    const first = firstDoseOn(items, "2026-10-12", "Europe/London");
    expect(first?.item.id).toBe("c");
    expect(first?.slot).toBe("07:30");
    expect(first?.dueAt.toISOString()).toBe("2026-10-12T06:30:00.000Z");
  });

  it("is null with no daily doses", () => {
    expect(firstDoseOn([items[1]], "2026-10-12", "Europe/London")).toBeNull();
  });
});

describe("cycleCells", () => {
  it("marks the days gone, today and the due day", () => {
    const { day, cells } = cycleCells("2026-09-22", "2026-10-11", 28);
    expect(day).toBe(19);
    expect(cells).toHaveLength(28);
    expect(cells.slice(0, 18).every((c) => c === "past")).toBe(true);
    expect(cells[18]).toBe("today");
    expect(cells[19]).toBe("");
    expect(cells[27]).toBe("due");
  });

  it("marks the due day as today when it arrives", () => {
    expect(cycleCells("2026-09-22", "2026-10-20", 28).cells[27]).toBe("today");
  });
});
