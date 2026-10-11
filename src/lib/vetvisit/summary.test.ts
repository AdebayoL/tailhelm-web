import { describe, expect, it } from "vitest";
import type { DoseSlot } from "@/lib/today/today";
import { checkGrid, daysAgoText, doseStatus, nextDueText } from "./summary";

const slot = (ticks: DoseSlot["ticks"], status: DoseSlot["status"] = ticks.length ? "given" : "due"): DoseSlot => ({
  item: { id: "p1", product: "Prednisolone", schedule_json: { kind: "fixed", times: ["08:00"] } },
  slot: "08:00",
  dueAt: new Date("2026-10-11T07:00:00Z"),
  status,
  ticks,
});

describe("doseStatus", () => {
  it("says who recorded it and when", () => {
    expect(doseStatus(slot([{ id: "t", at: "08:04", by: "Adebayo", mine: false, extra: false }]))).toEqual({
      kind: "given",
      text: "Given 08:04 by Adebayo",
      extras: [],
    });
  });

  it("says when it is due, or that it was not recorded", () => {
    expect(doseStatus(slot([])).text).toBe("Due at 08:00");
    expect(doseStatus(slot([], "late"))).toEqual({ kind: "late", text: "Not recorded · due at 08:00", extras: [] });
  });

  it("lists a second dose", () => {
    const s = doseStatus(
      slot([
        { id: "t", at: "08:05", by: "you", mine: true, extra: false },
        { id: "u", at: "09:00", by: "Sam", mine: false, extra: true },
      ]),
    );
    expect(s.extras).toEqual(["Second dose 09:00 by Sam"]);
  });
});

describe("daysAgoText and nextDueText", () => {
  it("count whole days on the owner's calendar", () => {
    expect(daysAgoText("2026-09-22", "2026-10-20")).toBe("28 days ago");
    expect(daysAgoText("2026-10-19", "2026-10-20")).toBe("yesterday");
    expect(daysAgoText("2026-10-20", "2026-10-20")).toBe("today");
  });

  it("say when the next injection falls", () => {
    expect(nextDueText({ dueOn: "2026-10-20", daysUntil: 0 })).toEqual({ text: "next due today", date: "20 Oct" });
    expect(nextDueText({ dueOn: "2026-10-24", daysUntil: 4 })?.text).toBe("next due 24 Oct");
    expect(nextDueText({ dueOn: "2026-10-18", daysUntil: -2 })?.text).toBe("was due 18 Oct");
    expect(nextDueText({ dueOn: null, daysUntil: null })).toBeNull();
  });
});

describe("checkGrid", () => {
  const signs = [
    { key: "vomiting", label: "Vomiting" },
    { key: "weakness", label: "Weakness" },
  ];

  it("marks seven days, oldest first, in the owner's time zone", () => {
    const grid = checkGrid(
      [
        { taken_at: "2026-10-10T23:30:00Z", values_json: {} }, // 00:30 on 11 Oct in London
        { taken_at: "2026-10-09T08:00:00Z", values_json: { weakness: true } },
        { taken_at: "2026-10-09T18:00:00Z", values_json: { vomiting: true } },
      ],
      signs,
      "2026-10-11",
      "Europe/London",
    );
    expect(grid.days).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(grid.rows[0].marks).toEqual([null, null, null, null, "ticked", null, "not-ticked"]);
    expect(grid.rows[1].marks.slice(4)).toEqual(["ticked", null, "not-ticked"]);
  });
});
