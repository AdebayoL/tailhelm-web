import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/plan/input";
import { QUEUED_TICK_MAX_AGE_MS, queuedTickKey, queuedTickOutcomeText, queuedTickTime } from "./ticks";

const now = new Date("2026-10-11T12:00:00Z");

describe("queuedTickTime", () => {
  it("keeps the time the tick was made", () => {
    expect(queuedTickTime("2026-10-11T07:02:00.000Z", now)?.toISOString()).toBe("2026-10-11T07:02:00.000Z");
  });

  it("takes a time a little in the future as now", () => {
    expect(queuedTickTime("2026-10-11T12:03:00Z", now)).toEqual(now);
  });

  it("refuses a time far in the future, too old, or not a time", () => {
    expect(queuedTickTime("2026-10-11T13:00:00Z", now)).toBeNull();
    expect(queuedTickTime(new Date(now.getTime() - QUEUED_TICK_MAX_AGE_MS - 1).toISOString(), now)).toBeNull();
    expect(queuedTickTime("yesterday", now)).toBeNull();
    expect(queuedTickTime(42, now)).toBeNull();
  });
});

describe("queuedTickKey", () => {
  it("is one per dose per day", () => {
    expect(queuedTickKey("item", "2026-10-11", "08:00")).toBe("item|2026-10-11|08:00");
  });
});

describe("queuedTickOutcomeText", () => {
  const tick = { slot: "08:00", givenOn: "2026-10-11", product: "Prednisolone" };

  it("says who got there first", () => {
    expect(queuedTickOutcomeText(tick, { alreadyGiven: { by: "Sam", at: "08:01" } }, formatDate)).toBe(
      "Prednisolone at 08:00 on 11 Oct 2026: Sam had already ticked it at 08:01. Your tick from no signal has not been recorded twice.",
    );
    expect(queuedTickOutcomeText(tick, { alreadyGiven: { by: "you", at: "07:59" } }, formatDate)).toContain(
      "You had already ticked it at 07:59.",
    );
  });

  it("says when it could not be recorded", () => {
    expect(queuedTickOutcomeText(tick, { failed: true }, formatDate)).toContain("could not be recorded");
  });

  it("says nothing when it went through", () => {
    expect(queuedTickOutcomeText(tick, {}, formatDate)).toBeNull();
  });
});
