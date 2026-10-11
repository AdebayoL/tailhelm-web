import { describe, expect, it } from "vitest";
import { reminderTimes } from "./times";

const pred = { id: "p", product: "Prednisolone", dose_amount: 2.5, dose_unit: "mg", schedule_json: { kind: "fixed" as const, times: ["18:00", "08:00"] } };
const zyc = { id: "z", product: "Zycortal", dose_amount: 1.1, dose_unit: "mL", schedule_json: { kind: "interval" as const, everyDays: 28, time: "18:00" } };
const test = { id: "t", product: "Blood test", dose_amount: null, dose_unit: null, schedule_json: { kind: "offset" as const, offsetsDays: [10, 25], time: "09:00" } };

describe("reminderTimes", () => {
  it("lists daily doses by time, then the next injection and test", () => {
    const rows = reminderTimes([zyc, pred, test], {
      date: "2026-10-18",
      countdowns: [{ item: zyc, dueOn: "2026-10-19", daysUntil: 1 }],
      tests: [{ item: test, upcoming: [{ item: test, day: 10, dueOn: "2026-10-29", daysUntil: 11 }] }],
    });
    expect(rows.map((r) => [r.time, r.name, r.rest, r.sub])).toEqual([
      ["08:00", "Prednisolone", "2.5 mg", "Every day"],
      ["18:00", "Prednisolone", "2.5 mg", "Every day"],
      ["18:00", "Zycortal", "tomorrow", "Mon 19 Oct"],
      ["09:00", "Blood test", "in 11 days", "Thu 29 Oct · day 10 after the injection"],
    ]);
  });

  it("says what starts the dates before the first injection is recorded", () => {
    const rows = reminderTimes([zyc, test], {
      date: "2026-10-18",
      countdowns: [{ item: zyc, dueOn: null, daysUntil: null }],
      tests: [{ item: test, upcoming: null }],
    });
    expect(rows.map((r) => [r.rest, r.sub])).toEqual([
      [null, "Once the first injection is recorded"],
      [null, "Once an injection is recorded"],
    ]);
  });
});
