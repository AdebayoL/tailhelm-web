import { describe, expect, it } from "vitest";
import { type HealthFacts, healthIssues } from "./health";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad)\b/i;
const day = (iso: string) => iso.slice(0, 10);

const facts = (over: Partial<HealthFacts> = {}): HealthFacts => ({
  now: new Date("2026-10-17T09:00:00Z"),
  me: "sam",
  dogName: "Bella",
  feeds: [],
  pushEverSent: false,
  pushPhones: 0,
  email: { on: true, lastFailed: false },
  ...over,
});

const feed = (over: Partial<HealthFacts["feeds"][number]> = {}) => ({
  app: "apple" as const,
  created_at: "2026-10-10T09:00:00Z",
  created_by: "sam",
  last_fetched_at: "2026-10-17T06:00:00Z",
  ...over,
});

describe("healthIssues", () => {
  it("finds nothing when every layer is working, or was never set up", () => {
    expect(healthIssues(facts(), day)).toEqual([]);
    expect(healthIssues(facts({ feeds: [feed()], pushEverSent: true, pushPhones: 1 }), day)).toEqual([]);
  });

  it("says when a calendar has gone two days without fetching the plan", () => {
    const stale = feed({ last_fetched_at: "2026-10-15T08:00:00Z" });
    expect(healthIssues(facts({ feeds: [stale] }), day)).toEqual([
      { key: "calendar", text: "Apple Calendar hasn’t fetched Bella’s plan since 2026-10-15." },
    ]);
    expect(healthIssues(facts({ feeds: [feed({ last_fetched_at: "2026-10-15T10:00:00Z" })] }), day)).toEqual([]);
  });

  it("says when a calendar never picked up the link", () => {
    const never = feed({ app: "google", created_at: "2026-10-14T09:00:00Z", last_fetched_at: null });
    expect(healthIssues(facts({ feeds: [never] }), day).map((i) => i.text)).toEqual([
      "Google Calendar hasn’t picked up Bella’s plan since the link was made on 2026-10-14.",
    ]);
    expect(healthIssues(facts({ feeds: [feed({ created_at: "2026-10-16T09:00:00Z", last_fetched_at: null })] }), day)).toEqual([]);
  });

  it("counts a calendar as working while any of this person's links is fetched", () => {
    const stale = feed({ last_fetched_at: "2026-10-01T08:00:00Z" });
    expect(healthIssues(facts({ feeds: [stale, feed({ app: "google" })] }), day)).toEqual([]);
  });

  it("leaves someone else's calendar to them", () => {
    const theirs = feed({ created_by: "alex", last_fetched_at: "2026-10-01T08:00:00Z" });
    expect(healthIssues(facts({ feeds: [theirs] }), day)).toEqual([]);
    expect(healthIssues(facts({ me: "alex", feeds: [theirs] }), day).map((i) => i.key)).toEqual(["calendar"]);
  });

  it("says when notifications that used to arrive have stopped", () => {
    expect(healthIssues(facts({ pushEverSent: true, pushPhones: 0 }), day)).toEqual([
      { key: "push", text: "Notifications have stopped reaching your phone." },
    ]);
    expect(healthIssues(facts({ pushEverSent: false, pushPhones: 0 }), day)).toEqual([]);
  });

  it("says when email reminders are off, or the last one could not be sent", () => {
    expect(healthIssues(facts({ email: { on: false, lastFailed: true } }), day).map((i) => i.key)).toEqual(["email_off"]);
    expect(healthIssues(facts({ email: { on: true, lastFailed: true } }), day).map((i) => i.key)).toEqual(["email_failed"]);
    expect(healthIssues(facts({ email: null }), day)).toEqual([]);
  });

  it("never uses a banned word", () => {
    const all = healthIssues(
      facts({
        feeds: [feed({ last_fetched_at: "2026-10-01T08:00:00Z" })],
        pushEverSent: true,
        email: { on: false, lastFailed: false },
      }),
      day,
    );
    expect(all).toHaveLength(3);
    for (const i of all) expect(i.text).not.toMatch(BANNED);
  });

  it("says when the monthly test went 2 days without being confirmed", () => {
    const sent = { monthlyTestAt: "2026-10-15T09:00:00Z" };
    expect(healthIssues(facts({ pushEverSent: true, pushPhones: 1, ...sent }), day)).toEqual([
      { key: "test", text: "The monthly test notification sent on 2026-10-15 wasn’t confirmed." },
    ]);
    expect(healthIssues(facts({ pushEverSent: true, pushPhones: 1, ...sent, lastConfirmed: "2026-10-15T09:01:00Z" }), day)).toEqual([]);
    expect(healthIssues(facts({ pushEverSent: true, pushPhones: 1, monthlyTestAt: "2026-10-16T09:00:00Z" }), day)).toEqual([]);
    // With no phone left, that is what the banner says instead.
    expect(healthIssues(facts({ pushEverSent: true, pushPhones: 0, ...sent }), day).map((i) => i.key)).toEqual(["push"]);
  });
});
