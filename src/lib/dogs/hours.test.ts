import { describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "@/engine/time";
import { type Hours, emergencyCalls, hoursLines, hoursNow, isOpen, nextOpening, parseHours, readHours } from "./hours";

const TZ = "Europe/London";
// 12 Oct 2026 is a Monday.
const at = (date: string, time: string) => zonedTimeToInstant(date, time, TZ);
const practice: Hours = {
  week: [["08:00", "19:00"], ["08:00", "19:00"], ["08:00", "19:00"], ["08:00", "19:00"], ["08:00", "19:00"], ["09:00", "13:00"], null],
};
const nights: Hours = { week: [["18:00", "08:00"], ["18:00", "08:00"], ["18:00", "08:00"], ["18:00", "08:00"], ["18:00", "08:00"], null, null] };

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseHours", () => {
  it("reads one span a day, Monday first", () => {
    const r = parseHours(form({ vet_0_open: "08:00", vet_0_close: "19:00", vet_5_open: "09:00", vet_5_close: "13:00" }), "vet");
    expect(r).toEqual({ ok: true, value: { week: [["08:00", "19:00"], null, null, null, null, ["09:00", "13:00"], null] } });
  });

  it("reads open around the clock, and nothing as nothing", () => {
    expect(parseHours(form({ ooh_always: "on", ooh_0_open: "08:00" }), "ooh")).toEqual({ ok: true, value: { always: true } });
    expect(parseHours(form({}), "vet")).toEqual({ ok: true, value: null });
  });

  it("needs both times on a day it opens", () => {
    expect(parseHours(form({ vet_2_open: "08:00" }), "vet").ok).toBe(false);
    expect(parseHours(form({ vet_2_open: "8am", vet_2_close: "19:00" }), "vet").ok).toBe(false);
    expect(parseHours(form({ vet_2_open: "08:00", vet_2_close: "08:00" }), "vet").ok).toBe(false);
  });

  it("ignores stored hours that do not fit", () => {
    expect(readHours({ always: true })).toEqual({ always: true });
    expect(readHours(practice)).toEqual(practice);
    expect(readHours({ week: [["8", "9"]] })).toBeNull();
    expect(readHours("Mon–Fri")).toBeNull();
  });
});

describe("hoursLines", () => {
  it("groups days with the same hours, as the design writes them", () => {
    expect(hoursLines(practice)).toEqual(["Mon–Fri 08:00–19:00", "Sat 09:00–13:00"]);
    expect(hoursLines({ always: true })).toEqual(["Open 24 hours"]);
    expect(hoursLines({ week: [null, ["08:00", "12:00"], null, ["08:00", "12:00"], null, null, null] })).toEqual([
      "Tue 08:00–12:00",
      "Thu 08:00–12:00",
    ]);
  });
});

describe("isOpen and when it next opens", () => {
  it("follows the day's span on the owner's clock", () => {
    expect(isOpen(practice, at("2026-10-12", "03:10"), TZ)).toBe(false);
    expect(isOpen(practice, at("2026-10-12", "08:00"), TZ)).toBe(true);
    expect(isOpen(practice, at("2026-10-12", "19:00"), TZ)).toBe(false);
    expect(isOpen(practice, at("2026-10-18", "10:00"), TZ)).toBe(false);
    expect(nextOpening(practice, at("2026-10-12", "03:10"), TZ)).toBe("08:00");
    expect(nextOpening(practice, at("2026-10-17", "14:00"), TZ)).toBe("Mon 08:00");
  });

  it("carries a night span past midnight", () => {
    expect(isOpen(nights, at("2026-10-12", "23:00"), TZ)).toBe(true);
    expect(isOpen(nights, at("2026-10-13", "03:00"), TZ)).toBe(true);
    expect(isOpen(nights, at("2026-10-13", "09:00"), TZ)).toBe(false);
    // Friday night runs into Saturday morning.
    expect(isOpen(nights, at("2026-10-17", "07:59"), TZ)).toBe(true);
    expect(hoursNow(nights, at("2026-10-13", "03:00"), TZ)).toBe("open until 08:00");
  });
});

describe("emergencyCalls", () => {
  const own = { name: "Larkfield Vets", phone: "01632 960 418", hours: practice };
  const ooh = { name: "Northgate Vets", phone: "01632 960 735", hours: { always: true } as Hours };

  it("puts the out-of-hours vet first when the saved hours say your vet is closed", () => {
    const r = emergencyCalls(own, ooh, at("2026-10-12", "03:10"), TZ);
    expect(r.first).toEqual({ title: "Call out-of-hours vet", sub: "Northgate Vets · open 24 hours", phone: "01632 960 735" });
    expect(r.second).toEqual({ title: "Call Larkfield Vets", sub: "Your own vet · opens 08:00", phone: "01632 960 418" });
    expect(r.why).toBe("Order chosen from the opening hours you saved for Larkfield Vets.");
  });

  it("puts your own vet first while it is open", () => {
    const r = emergencyCalls(own, ooh, at("2026-10-12", "10:00"), TZ);
    expect(r.first?.sub).toBe("Your own vet · open until 19:00");
  });

  it("puts your own vet first when no hours are saved", () => {
    const r = emergencyCalls({ ...own, hours: null }, { ...ooh, name: null, hours: null }, at("2026-10-12", "03:10"), TZ);
    expect(r.first?.title).toBe("Call Larkfield Vets");
    expect(r.second).toEqual({ title: "Call out-of-hours vet", sub: null, phone: "01632 960 735" });
    expect(r.why).toBe("If your own vet is closed, call the out-of-hours number.");
  });

  it("shows the one number there is", () => {
    const r = emergencyCalls({ ...own, phone: null }, ooh, at("2026-10-12", "10:00"), TZ);
    expect(r.first?.title).toBe("Call out-of-hours vet");
    expect(r.second).toBeNull();
  });
});
