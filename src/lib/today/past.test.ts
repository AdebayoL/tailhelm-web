import { describe, expect, it } from "vitest";
import { pastDays } from "./past";

const signs = [
  { key: "vomiting", label: "Vomiting" },
  { key: "weakness", label: "Weakness" },
];
const tz = "Europe/London";

describe("pastDays", () => {
  it("groups ticks, notes and stressful days by day, latest first", () => {
    const days = pastDays(
      {
        checks: [
          { taken_at: "2026-10-10T07:05:00Z", values_json: { weakness: true }, recorded_by: "sam" },
          { taken_at: "2026-10-10T09:00:00Z", values_json: { vomiting: true, weakness: true }, recorded_by: "ade" },
          { taken_at: "2026-10-11T19:27:00Z", values_json: { weakness: true }, recorded_by: "ade" },
        ],
        notes: [{ id: "n1", started_at: "2026-10-10T11:40:00Z", note: "Slower on the walk.", recorded_by: "ade", created_at: "2026-10-10T11:40:00Z" }],
        stress: [{ id: "e1", note: "Fireworks", started_at: "2026-10-09T11:00:00Z", ended_at: "2026-10-10T11:00:00Z" }],
        signs,
      },
      "2026-10-11",
      tz,
    );
    expect(days.map((d) => d.date)).toEqual(["2026-10-11", "2026-10-10", "2026-10-09"]);
    // The first tick of each sign counts, in the pack's order.
    expect(days[1].signs).toEqual([
      { key: "vomiting", label: "Vomiting", by: "ade", time: "10:00" },
      { key: "weakness", label: "Weakness", by: "sam", time: "08:05" },
    ]);
    expect(days[1].notes).toEqual([{ id: "n1", text: "Slower on the walk.", by: "ade", time: "12:40" }]);
    expect(days[1].stress.map((s) => s.title)).toEqual(["Fireworks"]);
    expect(days[2].stress.map((s) => s.title)).toEqual(["Fireworks"]);
    expect(days[0].signs.map((s) => s.time)).toEqual(["20:27"]);
  });

  it("leaves out anything older than the window or in the future", () => {
    const days = pastDays(
      {
        checks: [{ taken_at: "2026-09-01T10:00:00Z", values_json: { weakness: true }, recorded_by: "ade" }],
        notes: [],
        stress: [{ id: "e2", note: "Kennels", started_at: "2026-10-20T11:00:00Z", ended_at: null }],
        signs,
      },
      "2026-10-11",
      tz,
    );
    expect(days).toEqual([]);
  });

  it("shows no time for a note written after the day it is about", () => {
    const [day] = pastDays(
      {
        checks: [],
        notes: [{ id: "n2", started_at: "2026-10-08T11:00:00Z", note: "Off food.", recorded_by: "sam", created_at: "2026-10-10T08:00:00Z" }],
        stress: [],
        signs,
      },
      "2026-10-11",
      tz,
    );
    expect(day.notes[0].time).toBeNull();
  });

  it("ignores unticked values and signs the pack doesn't list", () => {
    const days = pastDays(
      { checks: [{ taken_at: "2026-10-10T10:00:00Z", values_json: { weakness: false, other: true }, recorded_by: "ade" }], notes: [], stress: [], signs },
      "2026-10-11",
      tz,
    );
    expect(days).toEqual([]);
  });
});
