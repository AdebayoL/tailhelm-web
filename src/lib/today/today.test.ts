import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/plan/input";
import {
  type Tick,
  type TodayInput,
  buildToday,
  nextActionText,
} from "./today";

const BANNED =
  /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad)\b/i;

const pred = {
  id: "pred",
  product: "Prednisolone",
  schedule_json: { kind: "fixed" as const, times: ["08:00", "20:00"] },
};
const docp = {
  id: "docp",
  product: "Zycortal",
  schedule_json: { kind: "interval" as const, everyDays: 28, time: "09:00" },
};

const tick = (over: Partial<Tick>): Tick => ({
  id: "t1",
  plan_item_id: "pred",
  given_on: "2026-10-09",
  slot: "08:00",
  extra_no: 0,
  given_at: "2026-10-09T07:04:00Z",
  given_by_profile: "sam",
  ...over,
});

const base = (over: Partial<TodayInput> = {}): TodayInput => ({
  now: new Date("2026-10-09T06:30:00Z"), // 07:30 in London (BST)
  timeZone: "Europe/London",
  me: "me",
  items: [pred],
  ticks: [],
  names: { sam: "Sam" },
  ...over,
});

const text = (input: TodayInput) =>
  nextActionText(buildToday(input).next, "Bella", formatDate);

describe("buildToday", () => {
  it("lists each dose due today in the owner's time zone, earliest first", () => {
    const today = buildToday(base());
    expect(today.date).toBe("2026-10-09");
    expect(today.doses.map((d) => [d.slot, d.status])).toEqual([
      ["08:00", "due"],
      ["20:00", "due"],
    ]);
    expect(text(base())).toEqual({
      title: "Bella’s Prednisolone, 08:00",
      detail: "Due at 08:00.",
    });
  });

  it("uses the owner's date, not UTC's, just after midnight", () => {
    expect(
      buildToday(base({ now: new Date("2026-10-09T23:30:00Z") })).date,
    ).toBe("2026-10-10");
  });

  it("marks a dose late 2 hours after its time", () => {
    const at = (iso: string) =>
      buildToday(base({ now: new Date(iso) })).doses[0].status;
    expect(at("2026-10-09T08:59:00Z")).toBe("due");
    expect(at("2026-10-09T09:00:00Z")).toBe("late");
    expect(text(base({ now: new Date("2026-10-09T09:00:00Z") })).detail).toBe(
      "Not ticked yet. It was due at 08:00.",
    );
  });

  it("shows who gave a dose and when, and moves the card on", () => {
    const today = buildToday(base({ ticks: [tick({})] }));
    expect(today.doses[0].status).toBe("given");
    expect(today.doses[0].ticks).toEqual([
      { id: "t1", at: "08:04", by: "Sam", mine: false, extra: false },
    ]);
    expect(text(base({ ticks: [tick({})] })).title).toBe(
      "Bella’s Prednisolone, 20:00",
    );
  });

  it("calls the owner's own tick theirs, and keeps a confirmed second dose visible", () => {
    const ticks = [
      tick({ given_by_profile: "me" }),
      tick({ id: "t2", extra_no: 1, given_by_profile: "ghost" }),
    ];
    expect(
      buildToday(base({ ticks })).doses[0].ticks.map((t) => [
        t.by,
        t.mine,
        t.extra,
      ]),
    ).toEqual([
      ["you", true, false],
      ["someone in the household", false, true],
    ]);
  });

  it("ignores ticks from another day", () => {
    expect(
      buildToday(base({ ticks: [tick({ given_on: "2026-10-08" })] })).doses[0]
        .status,
    ).toBe("due");
  });

  it("says so when everything is ticked, or nothing is due", () => {
    const ticks = [tick({}), tick({ id: "t2", slot: "20:00" })];
    expect(text(base({ ticks })).title).toBe(
      "Everything due for Bella today is ticked.",
    );
    expect(text(base({ items: [] })).title).toBe(
      "Nothing is due for Bella today.",
    );
  });
});

describe("injection countdown", () => {
  const withDocp = (anchoredOn?: string, over: Partial<TodayInput> = {}) =>
    base({
      items: [pred, docp],
      latestAnchor: anchoredOn ? { anchoredOn, cycleNo: 1 } : undefined,
      ...over,
    });

  it("has no date until an injection has been logged", () => {
    expect(buildToday(withDocp()).countdowns).toEqual([
      { item: docp, dueOn: null, daysUntil: null },
    ]);
  });

  it("counts down to the vet's interval from the last injection", () => {
    expect(buildToday(withDocp("2026-09-15")).countdowns[0]).toMatchObject({
      dueOn: "2026-10-13",
      daysUntil: 4,
    });
  });

  it("puts an overdue injection above a dose, with the vet as the only action", () => {
    expect(text(withDocp("2026-09-09"))).toEqual({
      title: "Bella’s Zycortal was due on 7 Oct 2026, 2 days ago.",
      detail: "Contact your vet today.",
    });
  });

  it("shows an injection due within 7 days once the doses are ticked", () => {
    const ticks = [tick({}), tick({ id: "t2", slot: "20:00" })];
    expect(text(withDocp("2026-09-15", { ticks })).title).toBe(
      "Bella’s Zycortal is due in 4 days, on 13 Oct 2026.",
    );
    expect(text(withDocp("2026-09-11", { ticks })).title).toBe(
      "Bella’s Zycortal is due today.",
    );
    expect(text(withDocp("2026-09-30", { ticks })).title).toBe(
      "Everything due for Bella today is ticked.",
    );
  });
});

describe("blood tests", () => {
  const bloods = {
    id: "bloods",
    product: "Sodium and potassium blood test",
    schedule_json: { kind: "offset" as const, offsetsDays: [25, 10], time: "09:00" },
  };
  const ticks = [tick({}), tick({ id: "t2", slot: "20:00" })];
  const withBloods = (anchoredOn?: string) =>
    base({
      items: [pred, docp, bloods],
      ticks,
      latestAnchor: anchoredOn ? { anchoredOn, cycleNo: 2 } : undefined,
    });

  it("has no dates until an injection has been logged", () => {
    expect(buildToday(withBloods()).tests).toEqual([{ item: bloods, upcoming: null }]);
  });

  it("dates each test from the latest injection, on the days the vet set", () => {
    expect(buildToday(withBloods("2026-10-01")).tests[0].upcoming).toEqual([
      { item: bloods, day: 10, dueOn: "2026-10-11", daysUntil: 2 },
      { item: bloods, day: 25, dueOn: "2026-10-26", daysUntil: 17 },
    ]);
  });

  it("drops a test date once it has passed", () => {
    expect(buildToday(withBloods("2026-09-20")).tests[0].upcoming).toEqual([
      { item: bloods, day: 25, dueOn: "2026-10-15", daysUntil: 6 },
    ]);
  });

  it("puts a test within 7 days on the card after the doses", () => {
    expect(text(withBloods("2026-10-01")).title).toBe(
      "Sodium and potassium blood test for Bella around day 10 after the injection: 11 Oct 2026, in 2 days.",
    );
    expect(text(withBloods("2026-09-29")).title).toBe(
      "Sodium and potassium blood test for Bella around today, as your vet asked.",
    );
    expect(text({ ...withBloods("2026-10-01"), ticks: [] }).title).toBe("Bella’s Prednisolone, 08:00");
  });

  it("puts an injection due soon above a test", () => {
    expect(text(withBloods("2026-09-14")).title).toBe("Bella’s Zycortal is due in 3 days, on 12 Oct 2026.");
  });
});

describe("stressful events", () => {
  const ticks = [tick({}), tick({ id: "t2", slot: "20:00" })];
  const kennels = { id: "e1", title: "Kennels", startsOn: "2026-10-15", endsOn: "2026-10-17" };

  it("lists events still to come or happening, and drops past ones", () => {
    const t = buildToday(base({ ticks, events: [kennels, { id: "e0", title: "Vet visit", startsOn: "2026-10-01", endsOn: null }] }));
    expect(t.events).toEqual([{ ...kennels, ongoing: false, daysUntil: 6 }]);
  });

  it("shows the vet's plan in their words on the card", () => {
    expect(nextActionText(buildToday(base({ ticks, events: [kennels] })).next, "Bella", formatDate, "Double the morning tablet.")).toEqual({
      title: "Kennels on 15 Oct 2026, in 6 days.",
      detail: "Your vet’s plan: Double the morning tablet.",
    });
  });

  it("asks the owner to ask the vet when there is no plan", () => {
    expect(text(base({ ticks, events: [{ ...kennels, startsOn: "2026-10-08" }] }))).toEqual({
      title: "Kennels, until 17 Oct 2026.",
      detail: "There is no stress plan for Bella yet. Ask your vet what to do for events like this.",
    });
  });

  it("waits until the doses are ticked", () => {
    expect(text(base({ events: [kennels] })).title).toBe("Bella’s Prednisolone, 08:00");
  });
});

it("never uses the words Tailhelm avoids", () => {
  const cases = [
    base(),
    base({ now: new Date("2026-10-09T12:00:00Z") }),
    base({
      items: [pred, docp],
      latestAnchor: { anchoredOn: "2026-09-01", cycleNo: 1 },
    }),
    base({
      items: [docp],
      latestAnchor: { anchoredOn: "2026-10-01", cycleNo: 1 },
    }),
    base({ items: [] }),
  ];
  for (const c of cases) {
    const t = text(c);
    expect(`${t.title} ${t.detail ?? ""}`).not.toMatch(BANNED);
  }
});
