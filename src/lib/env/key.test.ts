import { describe, expect, it } from "vitest";
import { cleanKey } from "./key";

describe("cleanKey", () => {
  it("removes spaces and line breaks picked up when a key was pasted", () => {
    expect(cleanKey(" sb_secret_abc-\n-def \n")).toBe("sb_secret_abc--def");
    expect(cleanKey("re_123\r\n")).toBe("re_123");
  });

  it("treats an empty or missing value as not set", () => {
    expect(cleanKey(undefined)).toBeUndefined();
    expect(cleanKey(" \n ")).toBeUndefined();
  });
});
