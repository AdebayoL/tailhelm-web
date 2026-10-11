import { describe, expect, it } from "vitest";
import type { DoseSlot } from "@/lib/today/today";
import { doseStatusText, wellbeingDays } from "./summary";

const slot = (ticks: DoseSlot["ticks"]): DoseSlot => ({
  item: { id: "p1", product: "Prednisolone", schedule_json: { kind: "fixed", times: ["08:00"] } },
  slot: "08:00",
  dueAt: new Date("2026-10-11T07:00:00Z"),
  status: ticks.length ? "given" : "due",
  ticks,
});

describe("doseStatusText", () => {
  it("says who ticked it and when", () => {
    expect(doseStatusText(slot([{ id: "t", at: "08:05", by: "Sam", mine: false, extra: false }]))).toBe(
      "08:00 Prednisolone: given at 08:05 by Sam.",
    );
  });

  it("says when it is not ticked", () => {
    expect(doseStatusText(slot([]))).toBe("08:00 Prednisolone: not ticked yet.");
  });

  it("counts extra doses", () => {
    expect(
      doseStatusText(
        slot([
          { id: "t", at: "08:05", by: "you", mine: true, extra: false },
          { id: "u", at: "09:00", by: "Sam", mine: false, extra: true },
        ]),
      ),
    ).toBe("08:00 Prednisolone: given at 08:05 by you. Extra dose logged: 1.");
  });
});

describe("wellbeingDays", () => {
  const signs = [
    { key: "vomiting", label: "Vomiting" },
    { key: "weakness", label: "Weakness" },
  ];

  it("lists seven days, newest first, in the owner's time zone", () => {
    const days = wellbeingDays(
      [
        { taken_at: "2026-10-10T23:30:00Z", values_json: {} }, // 00:30 on 11 Oct in London
        { taken_at: "2026-10-09T08:00:00Z", values_json: { weakness: true } },
        { taken_at: "2026-10-09T18:00:00Z", values_json: { vomiting: true } },
      ],
      signs,
      "2026-10-11",
      "Europe/London",
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2026-10-11", text: "Nothing noticed." });
    expect(days[1]).toEqual({ date: "2026-10-10", text: "No check saved." });
    expect(days[2]).toEqual({ date: "2026-10-09", text: "Vomiting, Weakness." });
    expect(days[6].date).toBe("2026-10-05");
  });
});
