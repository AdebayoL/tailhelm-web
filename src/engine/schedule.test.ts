import { describe, expect, it } from "vitest";
import addisons from "../../packs/addisons.pack.json";
import stubEpilepsy from "@/packs/fixtures/stub-epilepsy.pack.json";
import { MAX_WINDOW_DAYS, type PlanSchedule, daysSinceAnchor, nextIntervalDue, occurrences, parsePlanSchedule } from "./schedule";
import { addDays, daysBetween, isLocalDate, toLocal, zonedTimeToInstant } from "./time";

const LONDON = "Europe/London";
const iso = (o: { dueAt: Date }) => o.dueAt.toISOString();
const utc = (s: string) => new Date(s);

describe("time", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-01", "2026-11-05")).toBe(35);
  });

  it("rejects dates that do not exist", () => {
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(() => addDays("2026-13-01", 1)).toThrow();
  });

  it("places 08:00 in London on both sides of the clocks going back", () => {
    expect(zonedTimeToInstant("2026-10-24", "08:00", LONDON).toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect(zonedTimeToInstant("2026-10-26", "08:00", LONDON).toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });

  it("uses the first 01:30 when the clocks go back and it happens twice", () => {
    expect(zonedTimeToInstant("2026-10-25", "01:30", LONDON).toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("moves 01:30 forward by the gap when the clocks go forward and it does not exist", () => {
    const instant = zonedTimeToInstant("2027-03-28", "01:30", LONDON);
    expect(instant.toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(toLocal(instant, LONDON)).toEqual({ date: "2027-03-28", time: "02:30" });
  });
});

describe("parsePlanSchedule", () => {
  it("accepts a schedule whose kind matches the pack", () => {
    expect(parsePlanSchedule({ kind: "fixed", times: ["08:00"] }, "fixed")).toMatchObject({ ok: true });
  });

  it("rejects a schedule whose kind differs from the pack", () => {
    const result = parsePlanSchedule({ kind: "fixed", times: ["08:00"] }, "interval");
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a kind the engine does not have", () => {
    expect(parsePlanSchedule({ kind: "hourly", every: 2 }, "fixed")).toMatchObject({ ok: false });
  });

  it("rejects an amount, because a schedule never holds a dose", () => {
    const raw = { kind: "fixed", times: ["08:00"], amount: 2.5, unit: "mg" };
    expect(parsePlanSchedule(raw, "fixed")).toMatchObject({ ok: false });
  });

  it("rejects a time that is not a 24-hour time", () => {
    expect(parsePlanSchedule({ kind: "fixed", times: ["8am"] }, "fixed")).toMatchObject({ ok: false });
    expect(parsePlanSchedule({ kind: "fixed", times: ["24:00"] }, "fixed")).toMatchObject({ ok: false });
  });

  it("accepts every schedule kind the packs use", () => {
    const kinds = [...addisons.medicines, ...stubEpilepsy.medicines].map((m) => m.scheduleKind);
    const examples: Record<string, PlanSchedule> = {
      fixed: { kind: "fixed", times: ["08:00"] },
      interval: { kind: "interval", everyDays: 28, time: "09:00" },
      offset: { kind: "offset", offsetsDays: [10], time: "09:00" },
      series: { kind: "series", everyMinutes: 120, readings: 7 },
      event: { kind: "event" },
    };
    for (const kind of kinds) {
      expect(parsePlanSchedule(examples[kind], kind as PlanSchedule["kind"])).toMatchObject({ ok: true });
    }
  });
});

describe("fixed", () => {
  const twiceDaily: PlanSchedule = { kind: "fixed", times: ["20:00", "08:00"] };

  it("gives each time on each day, earliest first", () => {
    const found = occurrences(twiceDaily, { timeZone: LONDON }, utc("2026-10-01T00:00:00Z"), utc("2026-10-03T00:00:00Z"));
    expect(found.map((o) => `${o.localDate} ${o.localTime}`)).toEqual([
      "2026-10-01 08:00",
      "2026-10-01 20:00",
      "2026-10-02 08:00",
      "2026-10-02 20:00",
    ]);
  });

  it("keeps 08:00 local through the clocks going back", () => {
    const found = occurrences(
      { kind: "fixed", times: ["08:00"] },
      { timeZone: LONDON },
      utc("2026-10-24T00:00:00Z"),
      utc("2026-10-27T00:00:00Z"),
    );
    expect(found.map(iso)).toEqual(["2026-10-24T07:00:00.000Z", "2026-10-25T08:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
  });

  it("includes the start of the window and excludes the end", () => {
    const from = utc("2026-10-01T07:00:00Z");
    const found = occurrences({ kind: "fixed", times: ["08:00"] }, { timeZone: LONDON }, from, utc("2026-10-02T07:00:00Z"));
    expect(found.map(iso)).toEqual(["2026-10-01T07:00:00.000Z"]);
  });

  it("follows the owner's own time zone", () => {
    const found = occurrences(
      { kind: "fixed", times: ["08:00"] },
      { timeZone: "Europe/Paris" },
      utc("2026-10-01T00:00:00Z"),
      utc("2026-10-02T00:00:00Z"),
    );
    expect(found.map(iso)).toEqual(["2026-10-01T06:00:00.000Z"]);
  });

  it("counts a time once if the vet's times repeat", () => {
    const found = occurrences(
      { kind: "fixed", times: ["08:00", "08:00"] },
      { timeZone: LONDON },
      utc("2026-10-01T00:00:00Z"),
      utc("2026-10-02T00:00:00Z"),
    );
    expect(found).toHaveLength(1);
  });
});

describe("interval", () => {
  const docp: PlanSchedule = { kind: "interval", everyDays: 28, time: "09:00" };
  const anchor = { anchoredOn: "2026-10-01", cycleNo: 3 };

  it("gives only the next treatment after the latest anchor", () => {
    const found = occurrences(docp, { timeZone: LONDON, latestAnchor: anchor }, utc("2026-10-01T00:00:00Z"), utc("2027-03-01T00:00:00Z"));
    expect(found).toEqual([
      {
        dueAt: utc("2026-10-29T09:00:00Z"),
        localDate: "2026-10-29",
        localTime: "09:00",
        cycleNo: 3,
        daysSinceAnchor: 28,
      },
    ]);
  });

  it("gives nothing before any treatment has set an anchor", () => {
    expect(occurrences(docp, { timeZone: LONDON }, utc("2026-10-01T00:00:00Z"), utc("2026-12-01T00:00:00Z"))).toEqual([]);
    expect(nextIntervalDue(docp, { timeZone: LONDON })).toBeNull();
  });

  it("still reports the next treatment once its date has passed", () => {
    const next = nextIntervalDue(docp, { timeZone: LONDON, latestAnchor: anchor });
    expect(next?.localDate).toBe("2026-10-29");
    expect(occurrences(docp, { timeZone: LONDON, latestAnchor: anchor }, utc("2026-11-05T00:00:00Z"), utc("2026-11-06T00:00:00Z"))).toEqual([]);
  });
});

describe("offset", () => {
  const tests: PlanSchedule = { kind: "offset", offsetsDays: [25, 10], time: "09:00" };

  it("gives each offset from the latest anchor, with its cycle", () => {
    const found = occurrences(
      tests,
      { timeZone: LONDON, latestAnchor: { anchoredOn: "2026-10-01", cycleNo: 1 } },
      utc("2026-10-01T00:00:00Z"),
      utc("2026-12-01T00:00:00Z"),
    );
    expect(found.map((o) => [o.localDate, o.daysSinceAnchor, o.cycleNo])).toEqual([
      ["2026-10-11", 10, 1],
      ["2026-10-26", 25, 1],
    ]);
  });

  it("rebuilds from a new anchor each cycle", () => {
    const found = occurrences(
      tests,
      { timeZone: LONDON, latestAnchor: { anchoredOn: "2026-10-29", cycleNo: 2 } },
      utc("2026-10-01T00:00:00Z"),
      utc("2027-01-01T00:00:00Z"),
    );
    expect(found.map((o) => o.localDate)).toEqual(["2026-11-08", "2026-11-23"]);
    expect(found.every((o) => o.cycleNo === 2)).toBe(true);
  });

  it("gives nothing without an anchor", () => {
    expect(occurrences(tests, { timeZone: LONDON }, utc("2026-10-01T00:00:00Z"), utc("2026-12-01T00:00:00Z"))).toEqual([]);
  });
});

describe("series", () => {
  const curve: PlanSchedule = { kind: "series", everyMinutes: 120, readings: 7 };

  it("gives each reading from the moment the owner starts", () => {
    const found = occurrences(
      curve,
      { timeZone: LONDON, seriesStartedAt: utc("2026-10-01T06:15:00Z") },
      utc("2026-10-01T00:00:00Z"),
      utc("2026-10-02T00:00:00Z"),
    );
    expect(found.map((o) => [o.reading, o.localTime])).toEqual([
      [1, "07:15"],
      [2, "09:15"],
      [3, "11:15"],
      [4, "13:15"],
      [5, "15:15"],
      [6, "17:15"],
      [7, "19:15"],
    ]);
  });

  it("gives nothing until a series is started", () => {
    expect(occurrences(curve, { timeZone: LONDON }, utc("2026-10-01T00:00:00Z"), utc("2026-10-02T00:00:00Z"))).toEqual([]);
  });
});

describe("event", () => {
  it("is never scheduled", () => {
    expect(occurrences({ kind: "event" }, { timeZone: LONDON }, utc("2026-10-01T00:00:00Z"), utc("2026-11-01T00:00:00Z"))).toEqual([]);
  });
});

describe("window and context checks", () => {
  const daily: PlanSchedule = { kind: "fixed", times: ["08:00"] };

  it("rejects a window that ends before it starts", () => {
    expect(() => occurrences(daily, { timeZone: LONDON }, utc("2026-10-02T00:00:00Z"), utc("2026-10-01T00:00:00Z"))).toThrow();
  });

  it("rejects a window longer than the limit", () => {
    const from = utc("2026-10-01T00:00:00Z");
    const to = new Date(from.getTime() + (MAX_WINDOW_DAYS + 1) * 86_400_000);
    expect(() => occurrences(daily, { timeZone: LONDON }, from, to)).toThrow();
  });

  it("rejects a time zone the runtime does not know", () => {
    expect(() => occurrences(daily, { timeZone: "Mars/Olympus" }, utc("2026-10-01T00:00:00Z"), utc("2026-10-02T00:00:00Z"))).toThrow();
  });

  it("counts days since the anchor for placing a result in its cycle", () => {
    expect(daysSinceAnchor({ anchoredOn: "2026-10-01", cycleNo: 1 }, "2026-10-11")).toBe(10);
  });
});
