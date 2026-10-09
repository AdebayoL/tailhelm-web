import { describe, expect, it } from "vitest";
import { MESSAGES, messageForAuthError } from "./messages";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage)\b/i;

describe("messageForAuthError", () => {
  it("explains rate limits", () => {
    expect(messageForAuthError("over_email_send_rate_limit", "send")).toBe(MESSAGES.tooMany);
  });
  it("treats an expired code as a wrong code", () => {
    expect(messageForAuthError("otp_expired", "verify")).toBe(MESSAGES.wrongCode);
  });
  it("falls back by step", () => {
    expect(messageForAuthError(undefined, "send")).toBe(MESSAGES.unavailable);
    expect(messageForAuthError("anything", "verify")).toBe(MESSAGES.wrongCode);
  });
  it("keeps to the voice rules", () => {
    for (const text of Object.values(MESSAGES)) expect(text).not.toMatch(BANNED);
  });
});
