import { describe, expect, it } from "vitest";
import { type Tick, type TodayInput, buildToday } from "@/lib/today/today";
import { CATCH_UP_MS, EMAIL_KINDS, PUSH_KINDS, dueNotices, tickedNotice, usualGiver } from "./due";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad)\b/i;
const DOSE = /\d\s*(mg|ml|mcg|µg|tablet)/i;

const pred = { id: "pred", product: "Prednisolone", schedule_json: { kind: "fixed" as const, times: ["08:00", "20:00"] } };
const docp = { id: "docp", product: "Zycortal", schedule_json: { kind: "interval" as const, everyDays: 28, time: "09:00" } };
const test = { id: "test", product: "Blood test", schedule_json: { kind: "offset" as const, offsetsDays: [10, 25], time: "10:00" } };

const input = (now: string, over: Partial<TodayInput> = {}): TodayInput => ({
  now: new Date(now),
  timeZone: "Europe/London",
  me: "scheduler",
  items: [pred],
  ticks: [],
  names: {},
  ...over,
});

const notices = (now: string, over: Partial<TodayInput> = {}) =>
  dueNotices(buildToday(input(now, over)), "Bella", "Europe/London", new Date(now));

const tick = (over: Partial<Tick> = {}): Tick => ({
  id: "t1",
  plan_item_id: "pred",
  given_on: "2026-10-13",
  slot: "08:00",
  extra_no: 0,
  given_at: "2026-10-13T07:04:00Z",
  given_by_profile: "sam",
  ...over,
});

describe("dueNotices", () => {
  it("reminds at each dose time on the owner's clock, and not before", () => {
    expect(notices("2026-10-13T06:59:00Z")).toEqual([]); // 07:59 BST
    const due = notices("2026-10-13T07:00:00Z");
    expect(due.map((n) => [n.kind, n.ref, n.title, n.body])).toEqual([
      ["dose_due", "pred:2026-10-13:08:00", "Time for Bella’s Prednisolone", "Check the app before giving."],
    ]);
  });

  it("still sends a reminder a late run finds within the catch-up window, then stops", () => {
    expect(notices("2026-10-13T07:59:00Z").map((n) => n.kind)).toEqual(["dose_due"]);
    expect(notices(new Date(Date.parse("2026-10-13T07:00:00Z") + CATCH_UP_MS).toISOString())).toEqual([]);
  });

  it("says a dose isn't ticked 2 hours after its time", () => {
    const late = notices("2026-10-13T09:05:00Z");
    expect(late.map((n) => [n.kind, n.title, n.body])).toEqual([
      ["dose_not_ticked", "Bella’s Prednisolone isn’t ticked yet today", "It was due at 08:00."],
    ]);
    expect(late[0].tag).toBe("dose:pred:2026-10-13:08:00");
  });

  it("sends nothing for a dose already ticked", () => {
    expect(notices("2026-10-13T07:00:00Z", { ticks: [tick()] })).toEqual([]);
    expect(notices("2026-10-13T09:05:00Z", { ticks: [tick()] })).toEqual([]);
  });

  it("sends one more message at 21:00 for a dose still not ticked, with contact your vet", () => {
    const evening = notices("2026-10-13T20:00:00Z"); // 21:00 BST
    expect(evening.map((n) => [n.kind, n.ref, n.title, n.body])).toEqual([
      ["dose_evening", "pred:2026-10-13:08:00", "Bella’s Prednisolone still isn’t ticked today", "It was due at 08:00. If it was missed, contact your vet."],
    ]);
    expect(notices("2026-10-13T19:59:00Z").map((n) => n.kind)).toEqual(["dose_due"]); // the 20:00 dose, not yet the evening message
    expect(notices("2026-10-13T20:00:00Z", { ticks: [tick()] })).toEqual([]);
  });

  it("skips the 21:00 message for a dose whose 2-hour reminder is not due until after it", () => {
    const late = { ...pred, schedule_json: { kind: "fixed" as const, times: ["20:00"] } };
    expect(notices("2026-10-13T20:00:00Z", { items: [late] }).map((n) => n.kind)).toEqual([]);
    expect(notices("2026-10-13T21:00:00Z", { items: [late] }).map((n) => n.kind)).toEqual(["dose_not_ticked", "dose_escalation"]);
  });

  it("passes a dose still not ticked 4 hours after its time to the household, with contact your vet", () => {
    expect(notices("2026-10-13T10:59:00Z")).toEqual([]); // 11:59 BST
    const escalation = notices("2026-10-13T11:00:00Z"); // 12:00 BST
    expect(escalation.map((n) => [n.kind, n.ref, n.title, n.body])).toEqual([
      ["dose_escalation", "pred:2026-10-13:08:00", "Bella’s Prednisolone wasn’t logged today", "It was due at 08:00. If it was missed, contact your vet."],
    ]);
    expect(escalation[0].escalates).toEqual({ itemId: "pred", slot: "08:00" });
    expect(escalation[0].tag).toBe("dose:pred:2026-10-13:08:00");
    expect(notices("2026-10-13T11:00:00Z", { ticks: [tick()] })).toEqual([]);
  });

  it("escalates at 21:00 when that is sooner than 4 hours, but never before the 2-hour reminder", () => {
    const afternoon = { ...pred, schedule_json: { kind: "fixed" as const, times: ["18:00"] } };
    expect(notices("2026-10-13T20:00:00Z", { items: [afternoon] }).map((n) => n.kind)).toEqual(["dose_evening", "dose_escalation"]); // 21:00 BST, 3 hours after
    const late = { ...pred, schedule_json: { kind: "fixed" as const, times: ["20:00"] } };
    expect(notices("2026-10-13T20:00:00Z", { items: [late] }).map((n) => n.kind)).toEqual([]);
  });

  it("emails the 2-hour, 21:00 and injection reminders, and sends the 21:00 one by email only", () => {
    expect([...EMAIL_KINDS].sort()).toEqual(["dose_escalation", "dose_evening", "dose_not_ticked", "injection_overdue", "injection_soon"]);
    expect(PUSH_KINDS.has("dose_escalation")).toBe(true);
    expect(PUSH_KINDS.has("dose_evening")).toBe(false);
    expect(EMAIL_KINDS.has("dose_due")).toBe(false);
  });

  it("reminds 7 and 2 days before an injection, at its time", () => {
    const anchored = (now: string) => notices(now, { items: [docp], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } });
    // Due 20 Oct; 13 Oct is 7 days before.
    expect(anchored("2026-10-13T08:00:00Z").map((n) => [n.kind, n.title, n.body])).toEqual([
      ["injection_soon", "Bella’s Zycortal is due on 20 Oct", "Is it booked?"],
    ]);
    expect(anchored("2026-10-13T07:59:00Z")).toEqual([]);
    expect(anchored("2026-10-14T08:00:00Z")).toEqual([]);
    expect(anchored("2026-10-18T08:00:00Z").map((n) => n.ref)).toEqual(["docp:2026-10-20:2"]);
  });

  it("says an injection is overdue the day after the vet's date, with contact your vet", () => {
    const overdue = notices("2026-10-21T08:10:00Z", { items: [docp], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } });
    expect(overdue.map((n) => [n.kind, n.title, n.body])).toEqual([
      ["injection_overdue", "Bella’s Zycortal is overdue", "It was due on 20 Oct. Contact your vet today."],
    ]);
  });

  it("reminds on the day of a test the vet timed from the injection", () => {
    const due = notices("2026-10-02T09:00:00Z", { items: [test], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } });
    expect(due.map((n) => [n.kind, n.ref, n.title, n.body])).toEqual([
      ["test_due", "test:2026-10-02", "Blood test for Bella around today", "As your vet asked."],
    ]);
  });

  it("never carries a dose or a banned word", () => {
    const all = [
      ...notices("2026-10-13T07:00:00Z"),
      ...notices("2026-10-13T09:00:00Z"),
      ...notices("2026-10-13T11:00:00Z"),
      ...notices("2026-10-13T20:00:00Z"),
      ...notices("2026-10-13T08:00:00Z", { items: [docp], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } }),
      ...notices("2026-10-21T08:00:00Z", { items: [docp], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } }),
      ...notices("2026-10-02T09:00:00Z", { items: [test], latestAnchor: { anchoredOn: "2026-09-22", cycleNo: 3 } }),
    ];
    expect(all).toHaveLength(7);
    for (const n of all) {
      expect(`${n.title} ${n.body}`).not.toMatch(BANNED);
      expect(`${n.title} ${n.body}`).not.toMatch(DOSE);
    }
  });
});

describe("usualGiver", () => {
  const sam = (given_on: string) => tick({ given_on, given_at: `${given_on}T07:00:00Z`, given_by_profile: "sam" });
  const alex = (given_on: string) => tick({ given_on, given_at: `${given_on}T07:00:00Z`, given_by_profile: "alex" });

  it("is whoever ticks that dose most often", () => {
    expect(usualGiver([sam("2026-10-10"), sam("2026-10-11"), alex("2026-10-12")], "pred", "08:00", "owner")).toBe("sam");
  });

  it("looks only at the same medicine and time", () => {
    const evening = (d: string) => tick({ given_on: d, slot: "20:00", given_by_profile: "alex" });
    expect(usualGiver([sam("2026-10-10"), evening("2026-10-10"), evening("2026-10-11")], "pred", "08:00", "owner")).toBe("sam");
    expect(usualGiver([sam("2026-10-10")], "other", "08:00", "owner")).toBe("owner");
  });

  it("breaks a tie by who ticked it last", () => {
    expect(usualGiver([sam("2026-10-10"), alex("2026-10-11")], "pred", "08:00", "owner")).toBe("alex");
  });

  it("falls back to the owner with nothing to go on", () => {
    expect(usualGiver([], "pred", "08:00", "owner")).toBe("owner");
    expect(usualGiver([tick({ given_by_profile: null })], "pred", "08:00", "owner")).toBe("owner");
  });
});

describe("tickedNotice", () => {
  it("tells the rest of the household who gave it and when, replacing the reminder", () => {
    const n = tickedNotice({ dogName: "Bella", item: pred, date: "2026-10-13", slot: "08:00", extraNo: 0, by: "Sam", at: "08:04", now: new Date() });
    expect([n.title, n.body, n.tag]).toEqual(["Sam gave Bella’s Prednisolone at 08:04", "The 08:00 dose is ticked.", "dose:pred:2026-10-13:08:00"]);
    expect(`${n.title} ${n.body}`).not.toMatch(BANNED);
  });
});
