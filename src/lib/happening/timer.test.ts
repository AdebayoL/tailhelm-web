import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/plan/input";
import { clockText, durationText, happeningLabel, lastedText, needsDetail, passedThresholds, spokenTime } from "./timer";

describe("clockText", () => {
  it("counts minutes and seconds, then hours", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(7_900)).toBe("0:07");
    expect(clockText(252_000)).toBe("4:12");
    expect(clockText(3_852_000)).toBe("1:04:12");
  });

  it("never shows a negative time when the clock steps back", () => {
    expect(clockText(-5_000)).toBe("0:00");
  });
});

describe("durationText", () => {
  it("says how long in words", () => {
    expect(durationText(45)).toBe("45 s");
    expect(durationText(252)).toBe("4 min 12 s");
    expect(durationText(240)).toBe("4 min");
    expect(durationText(3852)).toBe("1 h 4 min");
    expect(durationText(7200)).toBe("2 h");
  });
});

describe("spokenTime", () => {
  it("reads the time once a minute, in words", () => {
    expect(spokenTime(30_000)).toBe("Under a minute");
    expect(spokenTime(60_000)).toBe("1 minute");
    expect(spokenTime(252_000)).toBe("4 minutes");
    expect(spokenTime(3_600_000)).toBe("1 hour");
    expect(spokenTime(3_852_000)).toBe("1 hour 4 minutes");
  });
});

describe("passedThresholds", () => {
  const limits = [
    { key: "thirty", afterMinutes: 30, ownerWording: "Thirty." },
    { key: "five", afterMinutes: 5, ownerWording: "Five." },
  ];

  it("is empty with no limits, as for Addison's", () => {
    expect(passedThresholds([], 3_600_000)).toEqual([]);
  });

  it("lists the limits passed, earliest first", () => {
    expect(passedThresholds(limits, 299_999)).toEqual([]);
    expect(passedThresholds(limits, 300_000).map((t) => t.key)).toEqual(["five"]);
    expect(passedThresholds(limits, 1_800_000).map((t) => t.key)).toEqual(["five", "thirty"]);
  });
});

describe("lastedText", () => {
  it("gives the length and the clock times", () => {
    expect(lastedText("2026-10-19T02:12:00Z", "2026-10-19T02:16:12Z", "Europe/London", formatDate)).toBe("It lasted 4 min 12 s, from 03:12 to 03:16.");
  });

  it("names the day it ended when it ran past midnight", () => {
    expect(lastedText("2026-10-18T22:50:00Z", "2026-10-18T23:20:00Z", "Europe/London", formatDate)).toBe(
      "It lasted 30 min, from 23:50 to 00:20 on 19 Oct 2026.",
    );
  });
});

describe("needsDetail", () => {
  const now = new Date("2026-10-21T02:00:00Z");

  it("keeps the card for 48 hours after it stopped", () => {
    expect(needsDetail({ ended_at: "2026-10-19T02:16:00Z", detail_complete: false }, now)).toBe(true);
    expect(needsDetail({ ended_at: "2026-10-19T01:59:00Z", detail_complete: false }, now)).toBe(false);
  });

  it("drops it once the detail is added, and never shows it while running", () => {
    expect(needsDetail({ ended_at: "2026-10-20T02:16:00Z", detail_complete: true }, now)).toBe(false);
    expect(needsDetail({ ended_at: null, detail_complete: false }, now)).toBe(false);
  });
});

describe("happeningLabel", () => {
  it("names the record with its length", () => {
    expect(happeningLabel({ started_at: "2026-10-19T02:12:00Z", ended_at: "2026-10-19T02:16:12Z" })).toBe("Happening now, 4 min 12 s");
    expect(happeningLabel({ started_at: "2026-10-19T02:12:00Z", ended_at: null })).toBe("Happening now, still running");
  });
});
