import { describe, expect, it } from "vitest";
import type { Tick } from "@/lib/today/today";
import { type PlanItemFact, TICK_GRACE_MS, expectedNotices, findGaps } from "./reconcile";

const pred: PlanItemFact = {
  id: "pred",
  product: "Prednisolone",
  schedule_json: { kind: "fixed", times: ["08:00", "20:00"] },
  createdAt: "2026-10-01T09:00:00Z",
};
const docp: PlanItemFact = {
  id: "docp",
  product: "Zycortal",
  schedule_json: { kind: "interval", everyDays: 28, time: "09:00" },
  createdAt: "2026-09-01T09:00:00Z",
};

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

const expected = (over: Partial<Parameters<typeof expectedNotices>[0]> = {}) =>
  expectedNotices({ date: "2026-10-13", timeZone: "Europe/London", dogName: "Bella", items: [pred], ticks: [], anchors: [], ...over }).map(
    (n) => `${n.kind} ${n.ref}`,
  );

describe("expectedNotices", () => {
  it("expects every reminder for a dose that was never ticked", () => {
    expect(expected()).toEqual([
      "dose_due pred:2026-10-13:08:00",
      "dose_not_ticked pred:2026-10-13:08:00",
      "dose_evening pred:2026-10-13:08:00",
      "dose_escalation pred:2026-10-13:08:00",
      "dose_due pred:2026-10-13:20:00",
      "dose_not_ticked pred:2026-10-13:20:00",
      "dose_escalation pred:2026-10-13:20:00",
    ]);
  });

  it("expects nothing for a dose ticked by its time, or soon enough after it that the scheduler had not run", () => {
    const morning = (given_at: string) => expected({ ticks: [tick({ given_at })] }).filter((n) => n.includes("08:00"));
    expect(morning("2026-10-13T06:55:00Z")).toEqual([]);
    expect(morning(new Date(Date.parse("2026-10-13T07:00:00Z") + TICK_GRACE_MS - 60_000).toISOString())).toEqual([]);
  });

  it("expects only the reminders whose time came before the tick", () => {
    // Ticked at 09:30 BST: the 08:00 reminder was due, the 2-hour one was not.
    expect(expected({ ticks: [tick({ given_at: "2026-10-13T08:30:00Z" })] }).filter((n) => n.includes("08:00"))).toEqual([
      "dose_due pred:2026-10-13:08:00",
    ]);
  });

  it("expects nothing whose time came before the plan item was entered", () => {
    // Entered at 13:00 BST: the 08:00 dose's 21:00 email still goes, since it is still not ticked then.
    expect(expected({ items: [{ ...pred, createdAt: "2026-10-13T12:00:00Z" }] })).toEqual([
      "dose_evening pred:2026-10-13:08:00",
      "dose_due pred:2026-10-13:20:00",
      "dose_not_ticked pred:2026-10-13:20:00",
      "dose_escalation pred:2026-10-13:20:00",
    ]);
  });

  it("expects injection reminders from the injection given on or before that day", () => {
    const anchors = [
      { anchoredOn: "2026-09-22", cycleNo: 3 },
      { anchoredOn: "2026-10-14", cycleNo: 4 },
    ];
    // Due 20 Oct from the injection on 22 Sep, so 13 Oct is 7 days before; the one on 14 Oct came later.
    expect(expected({ items: [docp], anchors })).toEqual(["injection_soon docp:2026-10-20:7"]);
  });
});

describe("findGaps", () => {
  const notices = expectedNotices({ date: "2026-10-13", timeZone: "Europe/London", dogName: "Bella", items: [pred], ticks: [], anchors: [] })
    .slice(0, 3)
    .map((notice) => ({ dogId: "bella", notice }));
  const row = (kind: string, ref: string, status: string, dog_id = "bella") => ({ dog_id, kind, ref, status });

  it("finds nothing when each expected reminder reached someone", () => {
    const rows = notices.flatMap(({ notice }) => [row(notice.kind, notice.ref, "no_device"), row(notice.kind, notice.ref, "sent")]);
    expect(findGaps(notices, rows)).toEqual([]);
  });

  it("names a reminder never logged, and one tried that reached nobody", () => {
    const rows = [
      row("dose_due", "pred:2026-10-13:08:00", "sent"),
      row("dose_not_ticked", "pred:2026-10-13:08:00", "failed"),
      row("dose_not_ticked", "pred:2026-10-13:08:00", "sending"),
      row("dose_evening", "pred:2026-10-13:08:00", "sent", "rex"),
    ];
    expect(findGaps(notices, rows)).toEqual([
      { dogId: "bella", kind: "dose_not_ticked", ref: "pred:2026-10-13:08:00", problem: "not_delivered" },
      { dogId: "bella", kind: "dose_evening", ref: "pred:2026-10-13:08:00", problem: "not_sent" },
    ]);
  });
});
