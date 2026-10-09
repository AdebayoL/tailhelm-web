import { describe, expect, it } from "vitest";
import { HOME_PATH, isProtectedPath, parseCode, parseEmail, safeNext } from "./input";

describe("parseEmail", () => {
  it("trims and lower-cases", () => {
    expect(parseEmail("  Owner@Example.co.uk ")).toBe("owner@example.co.uk");
  });
  it.each(["", "owner", "owner@", "@example.com", 42, undefined])("rejects %s", (raw) => {
    expect(parseEmail(raw)).toBeNull();
  });
});

describe("parseCode", () => {
  it.each(["123456", " 123 456 ", "123-456"])("accepts %s", (raw) => {
    expect(parseCode(raw)).toBe("123456");
  });
  it.each(["12345", "1234567", "12345a", "", null])("rejects %s", (raw) => {
    expect(parseCode(raw)).toBeNull();
  });
});

describe("safeNext", () => {
  it.each(["/today", "/today?dog=1", "/today#log"])("keeps the same-site path %s", (raw) => {
    expect(safeNext(raw)).toBe(raw);
  });
  it.each([
    undefined,
    "",
    "today",
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "/sign-in",
    "javascript:alert(1)",
  ])("falls back to home for %s", (raw) => {
    expect(safeNext(raw)).toBe(HOME_PATH);
  });
});

describe("isProtectedPath", () => {
  it("protects the app and its sub-pages", () => {
    expect(isProtectedPath("/today")).toBe(true);
    expect(isProtectedPath("/today/log")).toBe(true);
  });
  it("leaves public pages open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath("/todays-news")).toBe(false);
  });
});
