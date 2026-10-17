import { describe, expect, it } from "vitest";
import { day31Moment, day31Waits, outOfViewText, periodText } from "./offer";

describe("day31Moment", () => {
  it("comes on the day the first record leaves the 30 days, and not before", () => {
    expect(day31Moment("2026-09-17", "2026-10-16")).toBeNull();
    expect(day31Moment("2026-09-17", "2026-10-17")).toEqual({
      from: "2026-09-17",
      outOfView: { from: "2026-09-17", to: "2026-09-17" },
      late: 0,
    });
  });

  it("waits a week for a household that opens the app late, then passes", () => {
    expect(day31Moment("2026-09-17", "2026-10-23")?.outOfView).toEqual({ from: "2026-09-17", to: "2026-09-23" });
    expect(day31Moment("2026-09-17", "2026-10-24")).toBeNull();
  });

  it("needs a first record", () => {
    expect(day31Moment(null, "2026-10-17")).toBeNull();
    expect(day31Moment("2026-10-20", "2026-10-17")).toBeNull();
  });
});

describe("outOfViewText", () => {
  it("names the day that has moved out of view, and that it is kept", () => {
    expect(outOfViewText(day31Moment("2026-09-17", "2026-10-17")!)).toBe(
      "From today, the free plan shows the latest 30 days, so 17 Sep moves out of view. It’s kept, never deleted, and appears again with Plus.",
    );
    expect(outOfViewText(day31Moment("2026-09-17", "2026-10-19")!)).toBe(
      "The free plan shows the latest 30 days, so 17 Sep to 19 Sep are out of view. They’re kept, never deleted, and appear again with Plus.",
    );
  });
});

describe("periodText", () => {
  it("gives the year once, or both across a new year", () => {
    expect(periodText("2026-09-17", "2026-10-17")).toBe("17 Sep to 17 Oct 2026");
    expect(periodText("2026-12-10", "2027-01-09")).toBe("10 Dec 2026 to 9 Jan 2027");
  });
});

describe("day31Waits", () => {
  const now = new Date("2026-10-17T17:20:00Z");
  const quiet = { doses: [], injections: [], now, alert: false, happeningNow: false };

  it("waits while a dose is due now or late, but not for one later today", () => {
    expect(day31Waits({ ...quiet, doses: [{ status: "due", dueAt: new Date("2026-10-17T17:00:00Z") }] })).toBe(true);
    expect(day31Waits({ ...quiet, doses: [{ status: "late", dueAt: new Date("2026-10-17T07:00:00Z") }] })).toBe(true);
    expect(day31Waits({ ...quiet, doses: [{ status: "due", dueAt: new Date("2026-10-17T18:00:00Z") }] })).toBe(false);
    expect(day31Waits({ ...quiet, doses: [{ status: "given", dueAt: new Date("2026-10-17T07:00:00Z") }] })).toBe(false);
  });

  it("waits for an injection due today or overdue, an alert, or Happening now", () => {
    expect(day31Waits({ ...quiet, injections: [{ daysUntil: 0 }] })).toBe(true);
    expect(day31Waits({ ...quiet, injections: [{ daysUntil: -2 }] })).toBe(true);
    expect(day31Waits({ ...quiet, injections: [{ daysUntil: 3 }, { daysUntil: null }] })).toBe(false);
    expect(day31Waits({ ...quiet, alert: true })).toBe(true);
    expect(day31Waits({ ...quiet, happeningNow: true })).toBe(true);
    expect(day31Waits(quiet)).toBe(false);
  });
});
