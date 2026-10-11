import { describe, expect, it } from "vitest";
import { type Member, inviteErrorText, parseDisplayName, parseInviteForm, placesLeft } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseInviteForm", () => {
  it("accepts an email, lower-cased", () => {
    expect(parseInviteForm(form({ email: " Sam@Example.com " }), "ade@example.com")).toEqual({ ok: true, email: "sam@example.com" });
  });

  it("refuses a missing or malformed address", () => {
    expect(parseInviteForm(form({ email: "sam" }), null).ok).toBe(false);
  });

  it("refuses the owner's own address", () => {
    expect(parseInviteForm(form({ email: "ADE@example.com" }), "ade@example.com").ok).toBe(false);
  });
});

describe("parseDisplayName", () => {
  it("trims and limits the name", () => {
    expect(parseDisplayName(form({ display_name: "  Sam " }))).toEqual({ ok: true, name: "Sam" });
    expect(parseDisplayName(form({ display_name: "" })).ok).toBe(false);
    expect(parseDisplayName(form({ display_name: "x".repeat(41) })).ok).toBe(false);
  });
});

describe("placesLeft", () => {
  const m = (status: Member["status"]): Member => ({
    id: status,
    profile_id: null,
    role: "member",
    invited_email: null,
    status,
    invited_at: "",
  });
  it("counts members and open invitations against three", () => {
    expect(placesLeft([m("active")])).toBe(2);
    expect(placesLeft([m("active"), m("invited"), m("active")])).toBe(0);
  });
});

describe("inviteErrorText", () => {
  it("explains a duplicate and a full household", () => {
    expect(inviteErrorText("23505")).toMatch(/already invited/);
    expect(inviteErrorText("23514")).toMatch(/up to 3 people/);
  });
});
