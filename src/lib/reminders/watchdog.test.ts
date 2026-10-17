import { describe, expect, it } from "vitest";
import { deviceName } from "@/lib/push/device";
import {
  CONFIRM_WITHIN_MS,
  HEALTH_EMAIL_WITHIN_MS,
  goneDevice,
  goneProblem,
  isGoneProblem,
  monthlyTest,
  phoneLostEmail,
  testUnconfirmed,
  unconfirmedTestEmail,
  whose,
} from "./watchdog";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad)\b/i;
const DOSE = /\d\s*(mg|ml|mcg|µg|tablet)/i;
const LONDON = "Europe/London";
const later = (iso: string, ms: number) => new Date(Date.parse(iso) + ms);

describe("monthlyTest", () => {
  const due = (now: string, lastConfirmed: string | null = null, lastTestSent: string | null = null) =>
    monthlyTest({ now: new Date(now), timeZone: LONDON, lastConfirmed, lastTestSent });

  it("goes out from 10:00 on the person's clock to someone never tested, asking them to tap it", () => {
    expect(due("2026-10-17T08:59:00Z")).toBeNull(); // 09:59 BST
    const test = due("2026-10-17T09:00:00Z")!;
    expect([test.kind, test.ref, test.title, test.body, test.url]).toEqual([
      "monthly_test",
      "2026-10-17",
      "Monthly reminder test",
      "Tap here to confirm Tailhelm’s reminders reach this phone.",
      "/reminders?test=monthly",
    ]);
    expect(test.at.toISOString()).toBe("2026-10-17T09:00:00.000Z");
  });

  it("never goes out at night", () => {
    expect(due("2026-10-17T18:59:00Z")).not.toBeNull(); // 19:59 BST
    expect(due("2026-10-17T19:00:00Z")).toBeNull(); // 20:00 BST
    expect(due("2026-10-17T23:30:00Z")).toBeNull();
  });

  it("is due 30 days after the last confirmed test", () => {
    expect(due("2026-11-15T10:00:00Z", "2026-10-17T12:00:00Z")).toBeNull();
    expect(due("2026-11-16T10:00:00Z", "2026-10-17T12:00:00Z")?.ref).toBe("2026-11-16");
  });

  it("is due 30 days after the last one sent, even if that went unconfirmed", () => {
    expect(due("2026-11-10T10:00:00Z", null, "2026-10-17T09:00:00Z")).toBeNull();
    expect(due("2026-11-16T10:00:00Z", null, "2026-10-17T09:00:00Z")).not.toBeNull();
    // A test confirmed after the last monthly one moves the next one on.
    expect(due("2026-11-16T10:00:00Z", "2026-10-25T09:00:00Z", "2026-10-17T09:00:00Z")).toBeNull();
  });
});

describe("testUnconfirmed", () => {
  const sent = "2026-10-17T09:00:00Z";
  it("is true once 2 days pass with no test confirmed since", () => {
    expect(testUnconfirmed({ now: later(sent, CONFIRM_WITHIN_MS - 60_000), test: { at: sent }, lastConfirmed: null })).toBe(false);
    expect(testUnconfirmed({ now: later(sent, CONFIRM_WITHIN_MS), test: { at: sent }, lastConfirmed: null })).toBe(true);
    expect(testUnconfirmed({ now: later(sent, CONFIRM_WITHIN_MS), test: { at: sent }, lastConfirmed: "2026-10-01T09:00:00Z" })).toBe(true);
  });

  it("is false once any of the person's phones confirms a test after it, or with no test sent", () => {
    expect(testUnconfirmed({ now: later(sent, CONFIRM_WITHIN_MS * 3), test: { at: sent }, lastConfirmed: "2026-10-17T09:02:00Z" })).toBe(false);
    expect(testUnconfirmed({ now: later(sent, CONFIRM_WITHIN_MS * 3), test: null, lastConfirmed: null })).toBe(false);
  });
});

describe("unconfirmedTestEmail", () => {
  const test = { id: "row-1", at: "2026-10-17T09:00:00Z" };
  const email = (over: Partial<Parameters<typeof unconfirmedTestEmail>[0]> = {}) =>
    unconfirmedTestEmail({ now: later(test.at, CONFIRM_WITHIN_MS), timeZone: LONDON, test, lastConfirmed: null, phones: 1, dogNames: ["Bella"], ...over });

  it("tells the person, by email, that the test went unconfirmed and how to check", () => {
    const n = email()!;
    expect([n.kind, n.ref, n.title, n.body, n.url]).toEqual([
      "test_unconfirmed",
      "row-1",
      "Bella’s reminders may not reach you",
      "The test notification sent to your phone on 17 Oct wasn’t confirmed. Open Tailhelm on your phone, go to Reminders and send a test.",
      "/reminders",
    ]);
  });

  it("is not sent once the test is confirmed, to someone with no phone left, or days late", () => {
    expect(email({ lastConfirmed: "2026-10-18T09:00:00Z" })).toBeNull();
    expect(email({ phones: 0 })).toBeNull();
    expect(email({ now: later(test.at, CONFIRM_WITHIN_MS + HEALTH_EMAIL_WITHIN_MS) })).toBeNull();
  });
});

describe("phoneLostEmail", () => {
  const lost = { id: "row-2", at: "2026-10-17T07:00:00Z", detail: `${goneProblem(410, "iPhone")}; push service 500` };
  const email = (over: Partial<Parameters<typeof phoneLostEmail>[0]> = {}) =>
    phoneLostEmail({ now: new Date("2026-10-17T07:05:00Z"), timeZone: LONDON, lost, phones: 0, dogNames: ["Bella"], ...over });

  it("tells the person which phone stopped getting notifications, and how to turn them on again", () => {
    const n = email()!;
    expect([n.kind, n.ref, n.title, n.url]).toEqual(["phone_lost", "row-2", "Bella’s reminders can no longer reach your iPhone", "/reminders"]);
    expect(n.body).toBe(
      "Notifications to it stopped on 17 Oct. This happens when Tailhelm is removed from the Home Screen, its notifications are turned off, or the browser’s data is cleared. Open Tailhelm on your iPhone and turn notifications on again in Reminders.",
    );
  });

  it("is not sent to someone who still has a phone set up, or days late", () => {
    expect(email({ phones: 1 })).toBeNull();
    expect(email({ lost: null })).toBeNull();
    expect(email({ now: later(lost.at, HEALTH_EMAIL_WITHIN_MS) })).toBeNull();
  });

  it("names someone's reminders by their dog when they have one", () => {
    expect(email({ dogNames: ["Bella", "Rex"] })?.title).toBe("Your reminders can no longer reach your iPhone");
    expect(whose(["Bella", "Bella"])).toBe("Bella’s reminders");
    expect(whose([])).toBe("Your reminders");
  });
});

describe("gone phones in the delivery log", () => {
  it("records and reads back the kind of device", () => {
    expect(isGoneProblem(goneProblem(404, "Android phone"))).toBe(true);
    expect(isGoneProblem("push service 500")).toBe(false);
    expect(goneDevice("phone gone (410): Android phone; phone gone (410): iPad")).toBe("Android phone");
    expect(goneDevice("phone gone (410)")).toBe("phone");
    expect(goneDevice(null)).toBe("phone");
  });

  it("names devices the way an owner does", () => {
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iPhone");
    expect(deviceName("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("iPad");
    expect(deviceName("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("Android phone");
    expect(deviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("computer");
    expect(deviceName(null)).toBe("phone");
  });
});

describe("watchdog wording", () => {
  it("never carries a dose or a banned word", () => {
    const all = [
      monthlyTest({ now: new Date("2026-10-17T09:00:00Z"), timeZone: LONDON, lastConfirmed: null, lastTestSent: null }),
      unconfirmedTestEmail({
        now: new Date("2026-10-19T09:00:00Z"),
        timeZone: LONDON,
        test: { id: "a", at: "2026-10-17T09:00:00Z" },
        lastConfirmed: null,
        phones: 1,
        dogNames: ["Bella"],
      }),
      phoneLostEmail({
        now: new Date("2026-10-17T09:00:00Z"),
        timeZone: LONDON,
        lost: { id: "b", at: "2026-10-17T08:00:00Z", detail: goneProblem(410, "iPhone") },
        phones: 0,
        dogNames: ["Bella"],
      }),
    ];
    for (const n of all) {
      expect(n).not.toBeNull();
      expect(`${n!.title} ${n!.body}`).not.toMatch(BANNED);
      expect(`${n!.title} ${n!.body}`).not.toMatch(DOSE);
    }
  });
});
