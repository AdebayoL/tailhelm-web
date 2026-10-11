import { describe, expect, it } from "vitest";
import { offlineBannerText } from "./text";

describe("offlineBannerText", () => {
  const now = new Date("2026-10-11T13:00:00Z");

  it("gives the time a page from today was saved, in UK time", () => {
    expect(offlineBannerText(new Date("2026-10-11T07:05:00Z"), now)).toBe(
      "No signal. You’re seeing this page as it was at 08:05 today.",
    );
  });

  it("gives the date for an older copy", () => {
    expect(offlineBannerText(new Date("2026-10-09T19:30:00Z"), now)).toBe(
      "No signal. You’re seeing this page as it was at 20:30 on 9 Oct.",
    );
  });

  it("falls back to plain words when the saved time is unknown", () => {
    expect(offlineBannerText(null, now)).toBe("No signal. You’re seeing this page as it was when it was last loaded.");
  });
});
