import { type LocalDate, addDays, addMonths, daysBetween } from "@/engine/time";
import { historyStart } from "@/lib/history/window";
import type { Range } from "@/lib/results/input";
import { type Scale, kgFigure } from "@/lib/weight/input";

/**
 * The geometry of the Trends screen: the period shown, the weight chart and
 * the bar that places a lab value against the range printed on the owner's
 * report. Pure arithmetic on recorded numbers; nothing here judges them.
 */

export type Period = "30d" | "6m" | "all";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "6m", label: "6 months" },
  { key: "all", label: "All" },
];

export function parsePeriod(raw: string | string[] | undefined): Period {
  return PERIODS.find((p) => p.key === raw)?.key ?? "6m";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const firstOfMonth = (date: LocalDate) => `${date.slice(0, 7)}-01`;
const month = (date: LocalDate) => MONTHS[Number(date.slice(5, 7)) - 1];
const year = (date: LocalDate) => date.slice(0, 4);
const dayMonth = (date: LocalDate) => `${Number(date.slice(8, 10))} ${month(date)}`;

/**
 * The first day the period shows: for 30 days, the free plan's history line;
 * whole months for six months and all, so the axis starts on a month.
 */
export function periodStart(period: Period, today: LocalDate, earliest: LocalDate | null): LocalDate {
  if (period === "30d") return historyStart(today, false) as LocalDate;
  const sixMonths = firstOfMonth(addMonths(today, -6));
  if (period === "6m") return sixMonths;
  return earliest && earliest < sixMonths ? firstOfMonth(earliest) : sixMonths;
}

/** "Apr to Oct 2026", "Nov 2025 to Oct 2026", or for 30 days "11 Sep to 11 Oct 2026". */
export function spanText(period: Period, from: LocalDate, to: LocalDate): string {
  const sameYear = year(from) === year(to);
  if (period === "30d") return `${dayMonth(from)}${sameYear ? "" : ` ${year(from)}`} to ${dayMonth(to)} ${year(to)}`;
  return `${month(from)}${sameYear ? "" : ` ${year(from)}`} to ${month(to)} ${year(to)}`;
}

/** The phone's short label above the chart. */
export function periodText(period: Period, from: LocalDate): string {
  if (period === "30d") return "Last 30 days";
  if (period === "6m") return "Last 6 months";
  return `Since ${month(from)} ${year(from)}`;
}

export type WeightPoint = { on: LocalDate; kg: number; scale: Scale | null };

/** Where the chart sits inside its SVG, in the design's units. */
export type Frame = {
  width: number;
  height: number;
  /** The x of the first day, and the right edge of the plot. */
  x0: number;
  x1: number;
  /** The y of the highest and lowest gridline. */
  yTop: number;
  yBottom: number;
  /** The baseline, with its ticks and labels below it. */
  axis: number;
  yLabelX: number;
  xLabelY: number;
};

export const PHONE_FRAME: Frame = { width: 310, height: 168, x0: 44.5, x1: 302, yTop: 8, yBottom: 110.4, axis: 136.5, yLabelX: 34, xLabelY: 158 };
export const DESK_FRAME: Frame = { width: 656, height: 260, x0: 48.5, x1: 640, yTop: 12, yBottom: 172, axis: 212.5, yLabelX: 38, xLabelY: 238 };

const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Five gridlines a round step apart, from just below the lowest weight to at or above the highest. */
export function weightScale(values: number[]): { lo: number; step: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (const step of STEPS) {
    const lo = round(Math.floor(round(min / step)) * step);
    if (round(lo + 4 * step) >= max) return { lo, step, ticks: [0, 1, 2, 3, 4].map((i) => round(lo + i * step)) };
  }
  const step = STEPS[STEPS.length - 1];
  const lo = Math.floor(min / step) * step;
  return { lo, step, ticks: [0, 1, 2, 3, 4].map((i) => lo + i * step) };
}

const fixed = (n: number, step: number) => n.toFixed(step < 1 ? 1 : 0);

/** The axis labels: each month's first day, or each week for 30 days, thinned so they never crowd. */
export function dateTicks(period: Period, from: LocalDate, to: LocalDate): { on: LocalDate; label: string }[] {
  if (period === "30d") {
    return [28, 21, 14, 7, 0].map((n) => addDays(to, -n)).filter((d) => d >= from).map((on) => ({ on, label: dayMonth(on) }));
  }
  const months: LocalDate[] = [];
  for (let d = firstOfMonth(from) < from ? addMonths(firstOfMonth(from), 1) : firstOfMonth(from); d <= to; d = addMonths(d, 1)) months.push(d);
  const every = [1, 2, 3, 6, 12].find((n) => Math.ceil(months.length / n) <= 7) ?? 12;
  const multiYear = year(from) !== year(to);
  return months
    .filter((_, i) => i % every === 0)
    .map((on) => ({ on, label: multiYear && (on.slice(5, 7) === "01" || on === months[0]) ? `${month(on)} ${year(on).slice(2)}` : month(on) }));
}

export type WeightChart = {
  gridlines: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  /** Clinic weights, joined in date order. */
  line: string | null;
  dots: { x: number; y: number }[];
  /** Home or unrecorded scales: drawn alone, never joined, as scales can differ. */
  diamonds: { x: number; y: number }[];
  /** Injection days, drawn as dashed lines. */
  marks: number[];
  /** The latest clinic weight, labelled on a desktop. */
  latest: { x: number; y: number; label: string } | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function weightChart(points: WeightPoint[], from: LocalDate, to: LocalDate, period: Period, frame: Frame, injections: LocalDate[] = []): WeightChart {
  const span = Math.max(1, daysBetween(from, to));
  const x = (on: LocalDate) => r1(frame.x0 + (daysBetween(from, on) / span) * (frame.x1 - frame.x0));
  const inView = points.filter((p) => p.on >= from && p.on <= to).sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
  const { lo, step, ticks } = weightScale(inView.length > 0 ? inView.map((p) => p.kg) : [0]);
  const y = (kg: number) => r1(frame.yBottom - ((kg - lo) / (4 * step)) * (frame.yBottom - frame.yTop));
  const clinic = inView.filter((p) => p.scale === "clinic").map((p) => ({ x: x(p.on), y: y(p.kg), kg: p.kg }));
  const last = clinic[clinic.length - 1];
  return {
    gridlines: ticks.map((t) => ({ y: y(t), label: fixed(t, step) })),
    xTicks: dateTicks(period, from, to).map((t) => ({ x: x(t.on), label: t.label })),
    line: clinic.length > 1 ? clinic.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join("") : null,
    dots: clinic.map(({ x, y }) => ({ x, y })),
    diamonds: inView.filter((p) => p.scale !== "clinic").map((p) => ({ x: x(p.on), y: y(p.kg) })),
    marks: injections.filter((d) => d >= from && d <= to).map(x),
    latest: last ? { x: last.x, y: last.y, label: kgFigure(last.kg) } : null,
  };
}

/**
 * Where a value sits against the range on the owner's lab report, as
 * percentages of the bar: the range fills the middle, with room either side
 * for a value beyond it.
 */
export function rangeBar(value: number, range: Range): { band: { left: number; width: number }; mark: number } {
  const left = 20.6;
  const width = 58.8;
  const at = left + ((value - range.low) / (range.high - range.low)) * width;
  return { band: { left, width }, mark: Math.round(Math.min(99, Math.max(1, at)) * 10) / 10 };
}
