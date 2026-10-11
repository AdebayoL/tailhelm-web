import { describe, expect, it } from "vitest";
import { dayMonth, longDate, monthYear, weekdayDate, weekdayDayMonth } from "./dates";

describe("dates", () => {
  it("writes a date each way the screens use", () => {
    expect(dayMonth("2026-10-20")).toBe("20 Oct");
    expect(weekdayDayMonth("2026-10-20")).toBe("Tue 20 Oct");
    expect(weekdayDate("2026-09-22")).toBe("Tue 22 Sep 2026");
    expect(longDate("2026-10-11")).toBe("Sunday 11 October 2026");
    expect(monthYear("2019-03-01")).toBe("March 2019");
  });

  it("keeps the calendar day whatever the clock's zone", () => {
    expect(weekdayDayMonth("2026-03-29")).toBe("Sun 29 Mar");
    expect(weekdayDayMonth("2026-01-01")).toBe("Thu 1 Jan");
  });
});
