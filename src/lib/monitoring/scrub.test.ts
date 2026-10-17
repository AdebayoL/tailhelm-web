import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubDeep, scrubText, secretValues } from "./scrub";
import { sentryOptions } from "./sentry-options";

// Made-up keys in the shapes the app uses; none is a real key.
const SUPABASE = "sb_secret_TESTONLYabcdefgh12345678";
const PASTED = "sb_secret_TESTONLYabcd efgh12345678"; // a key pasted with a space in it
const RESEND = "re_TESTONLY_abcdefgh12345678";
const SIGNED = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbmF0dXJlLXRlc3Qtb25seQ";

describe("secretValues", () => {
  it("lists each secret whole, without its spaces, and in pieces, longest first", () => {
    expect(secretValues({ SUPABASE_SECRET_KEY: ` ${PASTED}\n`, CRON_SECRET: "cron-secret-test-only" })).toEqual([
      "sb_secret_TESTONLYabcd efgh12345678",
      "sb_secret_TESTONLYabcdefgh12345678",
      "sb_secret_TESTONLYabcd",
      "cron-secret-test-only",
      "efgh12345678",
    ]);
  });

  it("skips pieces too short to be a key, unset secrets and public settings", () => {
    expect(secretValues({ CRON_SECRET: "abc def", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toEqual([]);
    expect(secretValues({})).toEqual([]);
  });
});

describe("scrubText", () => {
  it("hides this server's own secret wherever it appears, whole or broken by a space", () => {
    const secrets = secretValues({ CRON_SECRET: "cron secret value-test-only" });
    expect(scrubText("auth failed for cron secret value-test-only", secrets)).toBe("auth failed for [hidden]");
    expect(scrubText("got cronsecretvalue-test-only", secrets)).toBe("got [hidden]");
    expect(scrubText("piece: value-test-only", secrets)).toBe("piece: [hidden]");
  });

  it("hides the error that once quoted a pasted key back", () => {
    const secrets = secretValues({ SUPABASE_SECRET_KEY: PASTED });
    const message = `Could not load households: TypeError: Headers.set: "Bearer ${PASTED}" is an invalid header value.`;
    const scrubbed = scrubText(message, secrets);
    expect(scrubbed).toBe('Could not load households: TypeError: Headers.set: "Bearer [hidden]" is an invalid header value.');
    expect(scrubbed).not.toContain("TESTONLY");
    expect(scrubbed).not.toContain("efgh12345678");
  });

  it("hides keys of a known shape even when they are not this server's own", () => {
    expect(scrubText(`apikey ${SUPABASE}`, [])).toBe("apikey [hidden]");
    expect(scrubText(`resend ${RESEND} refused`, [])).toBe("resend [hidden] refused");
    expect(scrubText(`token ${SIGNED}`, [])).toBe("token [hidden]");
    expect(scrubText("Authorization: Bearer abc.def-ghi", [])).toBe("Authorization: [hidden]");
  });

  it("leaves ordinary text as it is", () => {
    const text = "Reminders on 2026-10-16: 3 not sent, 1 reached nobody (dog 4f2a, re_check)";
    expect(scrubText(text, secretValues({ CRON_SECRET: "abc def" }))).toBe(text);
  });
});

describe("scrubDeep", () => {
  it("hides keys anywhere in a report without changing the original", () => {
    const secrets = secretValues({ SUPABASE_SECRET_KEY: PASTED });
    const at = new Date("2026-10-17T05:15:00Z");
    const event = {
      message: `failed with ${PASTED}`,
      exception: { values: [{ type: "TypeError", value: `Bearer ${PASTED}` }] },
      breadcrumbs: [{ category: "fetch", data: { headers: { apikey: SUPABASE }, status: 0 } }],
      extra: { at, count: 3, ok: false, none: null },
    };
    const scrubbed = scrubDeep(event, secrets);
    expect(scrubbed).toEqual({
      message: "failed with [hidden]",
      exception: { values: [{ type: "TypeError", value: "Bearer [hidden]" }] },
      breadcrumbs: [{ category: "fetch", data: { headers: { apikey: "[hidden]" }, status: 0 } }],
      extra: { at, count: 3, ok: false, none: null },
    });
    expect(scrubbed.extra.at).toBe(at);
    expect(event.message).toBe(`failed with ${PASTED}`);
  });

  it("stops at a depth limit instead of following a report that refers back to itself", () => {
    type Loop = { self?: Loop; text: string };
    const loop: Loop = { text: SUPABASE };
    loop.self = loop;
    const scrubbed = scrubDeep(loop, []);
    expect(scrubbed.text).toBe("[hidden]");
    expect(scrubbed.self?.text).toBe("[hidden]");
  });
});

describe("Sentry settings", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("scrub every report with the server's own secrets before it is sent", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", PASTED);
    const event = { message: `Bearer ${PASTED}`, extra: { key: PASTED } } as unknown as ErrorEvent;
    expect(sentryOptions.beforeSend(event)).toEqual({ message: "Bearer [hidden]", extra: { key: "[hidden]" } });
  });
});
