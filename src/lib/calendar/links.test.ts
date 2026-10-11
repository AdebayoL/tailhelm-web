import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newToken, sha256Hex, subscribeLinks } from "./links";

describe("subscribeLinks", () => {
  it("gives a webcal link for Apple and a Google subscribe link", () => {
    const links = subscribeLinks("https://www.tailhelm.com/calendar/abc.ics");
    expect(links.apple).toBe("webcal://www.tailhelm.com/calendar/abc.ics");
    expect(links.google).toBe("https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fwww.tailhelm.com%2Fcalendar%2Fabc.ics");
  });
});

describe("newToken and sha256Hex", () => {
  it("makes long, different, URL-safe tokens", () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("hashes as the database does", async () => {
    expect(await sha256Hex("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});
