import { describe, expect, it } from "vitest";
import { type Feed, buildCalendar, feedEvents, foldLine, icsText } from "./ics";

const now = new Date("2026-10-11T09:00:00Z");
const feed: Feed = {
  dog_name: "Bella",
  live: true,
  time_zone: "Europe/London",
  items: [
    { id: "pred", product: "Prednisolone", schedule: { kind: "fixed", times: ["08:00", "20:00"] } },
    { id: "docp", product: "Zycortal", schedule: { kind: "interval", everyDays: 28, time: "10:00" } },
    { id: "bloods", product: "Blood test", schedule: { kind: "offset", offsetsDays: [10, 25], time: "09:00" } },
    { id: "stress", product: "Stress plan", schedule: { kind: "event" } },
  ],
  anchor: { anchored_on: "2026-09-25", cycle_no: 3 },
};

describe("feedEvents", () => {
  const events = feedEvents(feed, now);

  it("repeats each daily dose at its time", () => {
    const daily = events.filter((e) => e.daily);
    expect(daily.map((e) => e.time)).toEqual(["08:00", "20:00"]);
    expect(daily[0].description).toBe("Time for Bella’s Prednisolone. Check the app before giving.");
  });

  it("puts the next injection on its date with alarms 7 and 2 days before", () => {
    const docp = events.find((e) => e.uid.startsWith("docp"))!;
    expect(docp.date).toBe("2026-10-23");
    expect(docp.alarms.map((a) => a.before)).toEqual(["-P7D", "-P2D", "PT0M"]);
    expect(docp.description).toBe("Bella’s Zycortal is due on 23 Oct. Is it booked?");
  });

  it("lists this cycle's tests from today on", () => {
    expect(events.filter((e) => e.uid.startsWith("bloods")).map((e) => e.date)).toEqual(["2026-10-20"]);
  });

  it("carries nothing for a stopped link", () => {
    expect(feedEvents({ dog_name: "Bella", live: false }, now)).toEqual([]);
  });

  it("waits for the first injection before dating injections and tests", () => {
    expect(feedEvents({ ...feed, anchor: null }, now).every((e) => e.daily)).toBe(true);
  });
});

describe("buildCalendar", () => {
  const ics = buildCalendar(feed, now);

  it("is a calendar with the dog's name and London's clock changes", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Tailhelm · Bella");
    expect(ics).toContain("TZID:Europe/London");
    expect(ics).toContain("DTSTART;TZID=Europe/London:20261011T080000");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("never carries a dose", () => {
    expect(ics).not.toMatch(/\d\s*(mg|ml|mL|tablets?)\b/);
  });

  it("is empty of events for a stopped link", () => {
    expect(buildCalendar({ dog_name: "Bella", live: false }, now)).not.toContain("BEGIN:VEVENT");
  });
});

describe("icsText and foldLine", () => {
  it("escapes commas, semicolons and line breaks", () => {
    expect(icsText("a, b; c\nd")).toBe("a\\, b\; c\\nd");
  });

  it("folds long lines at 75 octets", () => {
    const folded = foldLine(`DESCRIPTION:${"x".repeat(100)}`);
    expect(folded.split("\r\n ").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"x".repeat(100)}`);
  });
});
