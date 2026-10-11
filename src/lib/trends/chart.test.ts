import { describe, expect, it } from "vitest";
import { DESK_FRAME, PHONE_FRAME, dateTicks, parsePeriod, periodStart, periodText, rangeBar, spanText, weightChart, weightScale } from "./chart";

describe("the period", () => {
  it("defaults to six months", () => {
    expect(parsePeriod(undefined)).toBe("6m");
    expect(parsePeriod("forever")).toBe("6m");
    expect(parsePeriod("30d")).toBe("30d");
  });

  it("starts six months back on the first of a month", () => {
    expect(periodStart("6m", "2026-10-11", null)).toBe("2026-04-01");
    expect(periodStart("30d", "2026-10-11", null)).toBe("2026-09-11");
    expect(periodStart("all", "2026-10-11", "2025-03-14")).toBe("2025-03-01");
    expect(periodStart("all", "2026-10-11", "2026-09-01")).toBe("2026-04-01");
  });

  it("names the span the way the design does", () => {
    expect(spanText("6m", "2026-04-01", "2026-10-11")).toBe("Apr to Oct 2026");
    expect(spanText("all", "2025-11-01", "2026-10-11")).toBe("Nov 2025 to Oct 2026");
    expect(spanText("30d", "2026-09-11", "2026-10-11")).toBe("11 Sep to 11 Oct 2026");
    expect(periodText("6m", "2026-04-01")).toBe("Last 6 months");
    expect(periodText("all", "2025-03-01")).toBe("Since Mar 2025");
  });
});

describe("weightScale", () => {
  it("draws five gridlines a round step apart around the weights", () => {
    expect(weightScale([24.1, 24.3, 24.0, 24.6])).toEqual({ lo: 24, step: 0.2, ticks: [24, 24.2, 24.4, 24.6, 24.8] });
    expect(weightScale([8.25])).toEqual({ lo: 8.2, step: 0.1, ticks: [8.2, 8.3, 8.4, 8.5, 8.6] });
    expect(weightScale([30, 41]).step).toBe(5);
  });
});

describe("dateTicks", () => {
  it("marks each month's first day across six months", () => {
    expect(dateTicks("6m", "2026-04-01", "2026-10-11").map((t) => t.label)).toEqual(["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
  });

  it("marks weeks across 30 days", () => {
    expect(dateTicks("30d", "2026-09-11", "2026-10-11").map((t) => t.label)).toEqual(["13 Sep", "20 Sep", "27 Sep", "4 Oct", "11 Oct"]);
  });

  it("thins months over a long history and shows the year", () => {
    const labels = dateTicks("all", "2024-01-01", "2026-10-11").map((t) => t.label);
    expect(labels.length).toBeLessThanOrEqual(7);
    expect(labels[0]).toBe("Jan 24");
  });
});

describe("weightChart", () => {
  const points = [
    { on: "2026-04-07", kg: 24.1, scale: "clinic" as const },
    { on: "2026-09-22", kg: 24.6, scale: "clinic" as const },
    { on: "2026-10-04", kg: 24.3, scale: "home" as const },
    { on: "2025-01-01", kg: 30, scale: "clinic" as const },
  ];

  it("joins clinic weights, leaves home weights alone and skips what is out of view", () => {
    const c = weightChart(points, "2026-04-01", "2026-10-11", "6m", DESK_FRAME, ["2026-09-22", "2026-01-01"]);
    expect(c.gridlines.map((g) => g.label)).toEqual(["24.0", "24.2", "24.4", "24.6", "24.8"]);
    expect(c.gridlines[0].y).toBe(DESK_FRAME.yBottom);
    expect(c.gridlines[4].y).toBe(DESK_FRAME.yTop);
    expect(c.dots).toHaveLength(2);
    expect(c.line).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
    expect(c.diamonds).toHaveLength(1);
    expect(c.marks).toEqual([c.dots[1].x]);
    expect(c.latest).toEqual({ x: c.dots[1].x, y: 52, label: "24.6" });
    expect(c.xTicks[0]).toEqual({ x: DESK_FRAME.x0, label: "Apr" });
  });

  it("draws no line for a single clinic weight", () => {
    const c = weightChart(points.slice(0, 1), "2026-04-01", "2026-10-11", "6m", PHONE_FRAME);
    expect(c.line).toBeNull();
    expect(c.dots).toHaveLength(1);
  });
});

describe("rangeBar", () => {
  it("places the value against the range on the lab report", () => {
    expect(rangeBar(146, { low: 140, high: 155 })).toEqual({ band: { left: 20.6, width: 58.8 }, mark: 44.1 });
    expect(rangeBar(10.2, { low: 2.5, high: 9.6 }).mark).toBe(84.4);
  });

  it("keeps a value far outside the range on the bar", () => {
    expect(rangeBar(1000, { low: 1, high: 2 }).mark).toBe(99);
    expect(rangeBar(0, { low: 100, high: 200 }).mark).toBe(1);
  });
});
