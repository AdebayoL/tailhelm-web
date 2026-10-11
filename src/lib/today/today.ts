import {
  type PlanSchedule,
  nextIntervalDue,
  occurrences,
} from "@/engine/schedule";
import {
  type LocalDate,
  type LocalTime,
  addDays,
  daysBetween,
  toLocal,
  zonedTimeToInstant,
} from "@/engine/time";

/**
 * What the Today screen shows: each dose due today with who gave it, each
 * injection countdown, and the one next action. Pure, so it can be tested
 * without a database and later run offline from the cached schedule.
 *
 * Nothing here produces an amount. Amounts come from the plan item as the
 * owner typed them, and the only action ever suggested is to contact the vet.
 */

/** A dose is "late" once it is this long past its time without a tick (spec: amber after 2 hours). */
export const LATE_AFTER_MS = 2 * 60 * 60 * 1000;
/** An injection appears on the next-action card from this many days before it is due. */
export const SOON_DAYS = 7;

export type TodayItem = {
  id: string;
  product: string | null;
  schedule_json: PlanSchedule;
};

export type Tick = {
  id: string;
  plan_item_id: string;
  given_on: LocalDate;
  slot: string;
  extra_no: number;
  given_at: string;
  given_by_profile: string | null;
};

export type TickView = {
  id: string;
  at: LocalTime;
  by: string;
  mine: boolean;
  extra: boolean;
};

export type DoseSlot = {
  item: TodayItem;
  slot: LocalTime;
  dueAt: Date;
  status: "given" | "due" | "late";
  ticks: TickView[];
};

export type Countdown = {
  item: TodayItem;
  /** Null until the first injection has been logged. */
  dueOn: LocalDate | null;
  /** Days from today to the due date; negative once it has passed. */
  daysUntil: number | null;
};

/** One test the vet asked for on a set day after the latest injection. */
export type TestDate = {
  item: TodayItem;
  /** Days after the injection, as the vet set it. */
  day: number;
  dueOn: LocalDate;
  daysUntil: number;
};

export type TestPlan = {
  item: TodayItem;
  /** The dates still to come in this cycle; null until an injection is logged. */
  upcoming: TestDate[] | null;
};

/** A stressful event the owner has planned for. */
export type PlannedEvent = { id: string; title: string; startsOn: LocalDate; endsOn: LocalDate | null };

export type EventDate = PlannedEvent & {
  /** Days from today to the start; 0 while it is happening. */
  daysUntil: number;
  ongoing: boolean;
};

export type NextAction =
  | { kind: "overdue"; countdown: Countdown }
  | { kind: "dose"; dose: DoseSlot }
  | { kind: "soon"; countdown: Countdown }
  | { kind: "test"; test: TestDate }
  | { kind: "event"; event: EventDate }
  | { kind: "clear"; allTicked: boolean };

export type TodayInput = {
  now: Date;
  timeZone: string;
  me: string;
  items: TodayItem[];
  ticks: Tick[];
  /** The latest anchor of the dog's condition, if an injection has been logged. */
  latestAnchor?: { anchoredOn: LocalDate; cycleNo: number };
  names: Record<string, string>;
  /** Stressful events planned from today on. */
  events?: PlannedEvent[];
};

export type Today = {
  date: LocalDate;
  doses: DoseSlot[];
  countdowns: Countdown[];
  tests: TestPlan[];
  events: EventDate[];
  next: NextAction;
};

export function buildToday(input: TodayInput): Today {
  const { now, timeZone, me, names } = input;
  const date = toLocal(now, timeZone).date;
  const dayStart = zonedTimeToInstant(date, "00:00", timeZone);
  const dayEnd = zonedTimeToInstant(addDays(date, 1), "00:00", timeZone);

  const view = (t: Tick): TickView => ({
    id: t.id,
    at: toLocal(new Date(t.given_at), timeZone).time,
    by:
      t.given_by_profile === me
        ? "you"
        : ((t.given_by_profile && names[t.given_by_profile]) ??
          "someone in the household"),
    mine: t.given_by_profile === me,
    extra: t.extra_no > 0,
  });

  const doses: DoseSlot[] = [];
  const countdowns: Countdown[] = [];
  const tests: TestPlan[] = [];
  for (const item of input.items) {
    const schedule = item.schedule_json;
    if (schedule.kind === "fixed") {
      for (const o of occurrences(schedule, { timeZone }, dayStart, dayEnd)) {
        const ticks = input.ticks
          .filter(
            (t) =>
              t.plan_item_id === item.id &&
              t.given_on === date &&
              t.slot === o.localTime,
          )
          .sort((a, b) => a.extra_no - b.extra_no)
          .map(view);
        const status =
          ticks.length > 0
            ? "given"
            : now.getTime() >= o.dueAt.getTime() + LATE_AFTER_MS
              ? "late"
              : "due";
        doses.push({ item, slot: o.localTime, dueAt: o.dueAt, status, ticks });
      }
    } else if (schedule.kind === "interval") {
      const next = nextIntervalDue(schedule, {
        timeZone,
        latestAnchor: input.latestAnchor,
      });
      countdowns.push({
        item,
        dueOn: next?.localDate ?? null,
        daysUntil: next ? daysBetween(date, next.localDate) : null,
      });
    } else if (schedule.kind === "offset") {
      const anchor = input.latestAnchor;
      tests.push({
        item,
        upcoming: anchor
          ? [...new Set(schedule.offsetsDays)]
              .sort((a, b) => a - b)
              .map((day) => {
                const dueOn = addDays(anchor.anchoredOn, day);
                return { item, day, dueOn, daysUntil: daysBetween(date, dueOn) };
              })
              .filter((t) => t.daysUntil >= 0)
          : null,
      });
    }
  }
  doses.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const events: EventDate[] = (input.events ?? [])
    .filter((e) => (e.endsOn ?? e.startsOn) >= date)
    .map((e) => {
      const ongoing = e.startsOn <= date;
      return { ...e, ongoing, daysUntil: ongoing ? 0 : daysBetween(date, e.startsOn) };
    })
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  return { date, doses, countdowns, tests, events, next: nextAction(doses, countdowns, tests, events) };
}

/** The spec's priority order, for the items this screen knows about so far. */
function nextAction(doses: DoseSlot[], countdowns: Countdown[], tests: TestPlan[], events: EventDate[]): NextAction {
  const dated = countdowns
    .filter((c) => c.daysUntil !== null)
    .sort((a, b) => a.daysUntil! - b.daysUntil!);
  const overdue = dated.find((c) => c.daysUntil! < 0);
  if (overdue) return { kind: "overdue", countdown: overdue };
  const dose = doses.find((d) => d.status !== "given");
  if (dose) return { kind: "dose", dose };
  const soon = dated.find((c) => c.daysUntil! <= SOON_DAYS);
  if (soon) return { kind: "soon", countdown: soon };
  // A test or stressful event, whichever comes first, within the week.
  const test = tests
    .flatMap((t) => t.upcoming ?? [])
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .find((t) => t.daysUntil <= SOON_DAYS);
  const event = events.find((e) => e.daysUntil <= SOON_DAYS);
  if (event && (!test || event.daysUntil < test.daysUntil)) return { kind: "event", event };
  if (test) return { kind: "test", test };
  return { kind: "clear", allTicked: doses.length > 0 };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The words on the next-action card. Numbers and dates only; the one action is to contact the vet. */
export function nextActionText(
  next: NextAction,
  dogName: string,
  formatDate: (d: LocalDate) => string,
  /** The vet's stress plan, in their words, if the owner has added one. */
  stressPlan: string | null = null,
) {
  const name = (item: TodayItem, fallback: string) =>
    `${dogName}’s ${item.product ?? fallback}`;
  switch (next.kind) {
    case "overdue": {
      const { item, dueOn, daysUntil } = next.countdown;
      return {
        title: `${name(item, "injection")} was due on ${formatDate(dueOn!)}, ${plural(-daysUntil!, "day")} ago.`,
        detail: "Contact your vet today.",
      };
    }
    case "dose": {
      const { item, slot, status } = next.dose;
      return {
        title: `${name(item, "medicine")}, ${slot}`,
        detail:
          status === "late"
            ? `Not ticked yet. It was due at ${slot}.`
            : `Due at ${slot}.`,
      };
    }
    case "soon": {
      const { item, dueOn, daysUntil } = next.countdown;
      return {
        title:
          daysUntil === 0
            ? `${name(item, "injection")} is due today.`
            : `${name(item, "injection")} is due in ${plural(daysUntil!, "day")}, on ${formatDate(dueOn!)}.`,
        detail: null,
      };
    }
    case "test": {
      const { item, day, dueOn, daysUntil } = next.test;
      const what = `${item.product ?? "Blood test"} for ${dogName}`;
      return {
        title:
          daysUntil === 0
            ? `${what} around today, as your vet asked.`
            : `${what} around day ${day} after the injection: ${formatDate(dueOn)}, in ${plural(daysUntil, "day")}.`,
        detail: null,
      };
    }
    case "event": {
      const { title, startsOn, endsOn, daysUntil, ongoing } = next.event;
      return {
        title: ongoing
          ? `${title}${endsOn ? `, until ${formatDate(endsOn)}` : ", today"}.`
          : `${title} on ${formatDate(startsOn)}, in ${plural(daysUntil, "day")}.`,
        detail: stressPlan
          ? `Your vet’s plan: ${stressPlan}`
          : `There is no stress plan for ${dogName} yet. Ask your vet what to do for events like this.`,
      };
    }
    case "clear":
      return {
        title: next.allTicked
          ? `Everything due for ${dogName} today is ticked.`
          : `Nothing is due for ${dogName} today.`,
        detail: null,
      };
  }
}
