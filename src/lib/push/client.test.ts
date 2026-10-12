import { describe, expect, it } from "vitest";
import { base64UrlToBytes } from "./client";

describe("base64UrlToBytes", () => {
  it("decodes the URL-safe public key without padding", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
