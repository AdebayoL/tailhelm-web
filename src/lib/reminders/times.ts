import { type LocalDate, type LocalTime, daysBetween } from "@/engine/time";
import { weekdayDayMonth } from "@/lib/app/dates";
import { doseText } from "@/lib/plan/input";
import type { Countdown, TestPlan } from "@/lib/today/today";
import type { PlanSchedule } from "@/engine/schedule";
import type { Jewel } from "@/lib/app/jewel";

/** One line of Reminder times: "08:00 **Prednisolone** 2.5 mg", "Every day". */
export type ReminderRow = { key: string; time: LocalTime; name: string; rest: string | null; sub: string; jewel: Jewel };

type Item = { id: string; product: string | null; dose_amount: number | null; dose_unit: string | null; schedule_json: PlanSchedule };

/** "today", "tomorrow", "in 8 days", or "was due" once the day has passed. */
function when(on: LocalDate, today: LocalDate): string {
  const days = daysBetween(today, on);
  return days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : "was due";
}

/**
 * What reminds the household, and when: each daily dose at its times, then
 * the next injection and the next test the vet timed from it.
 */
export function reminderTimes(items: Item[], today: { date: LocalDate; countdowns: Countdown[]; tests: TestPlan[] }): ReminderRow[] {
  const daily: ReminderRow[] = items
    .flatMap((item) =>
      item.schedule_json.kind === "fixed"
        ? item.schedule_json.times.map((time) => ({
            key: `${item.id}-${time}`,
            time,
            name: item.product ?? "Medicine",
            rest: doseText(item),
            sub: "Every day",
            jewel: "pred" as const,
          }))
        : [],
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const dated: (ReminderRow & { on: LocalDate | null })[] = [];
  for (const c of today.countdowns) {
    if (c.item.schedule_json.kind !== "interval") continue;
    dated.push({
      key: c.item.id,
      time: c.item.schedule_json.time,
      name: c.item.product ?? "Injection",
      rest: c.dueOn ? when(c.dueOn, today.date) : null,
      sub: c.dueOn ? weekdayDayMonth(c.dueOn) : "Once the first injection is recorded",
      jewel: "zyc",
      on: c.dueOn,
    });
  }
  for (const t of today.tests) {
    if (t.item.schedule_json.kind !== "offset") continue;
    const next = t.upcoming?.[0];
    dated.push({
      key: t.item.id,
      time: t.item.schedule_json.time,
      name: t.item.product ?? "Blood test",
      rest: next ? when(next.dueOn, today.date) : null,
      sub: next
        ? `${weekdayDayMonth(next.dueOn)} · day ${next.day} after the injection`
        : t.upcoming === null
          ? "Once an injection is recorded"
          : "None left before the next injection",
      jewel: "meas",
      on: next?.dueOn ?? null,
    });
  }
  dated.sort((a, b) => (a.on ?? "9999").localeCompare(b.on ?? "9999") || (a.on ? a.time.localeCompare(b.time) : 0));
  return [...daily, ...dated.map((r) => ({ key: r.key, time: r.time, name: r.name, rest: r.rest, sub: r.sub, jewel: r.jewel }))];
}
