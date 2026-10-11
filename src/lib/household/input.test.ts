import { describe, expect, it } from "vitest";
import { type Member, careTeam, closedBefore, invitationExpires, inviteErrorText, isOpenInvitation, parseDisplayName, parseInviteForm, placesLeft } from "./input";

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

const now = new Date("2026-10-11T12:00:00Z");
const row = (over: Partial<Member>): Member => ({
  id: "x",
  profile_id: null,
  role: "member",
  invited_email: null,
  status: "active",
  invited_at: "2026-10-01T09:00:00Z",
  joined_at: null,
  declined_at: null,
  revoked_at: null,
  ...over,
});

describe("invitations", () => {
  it("stay open for 7 days after they are sent", () => {
    expect(invitationExpires("2026-10-09T10:00:00Z").toISOString()).toBe("2026-10-16T10:00:00.000Z");
    expect(isOpenInvitation(row({ status: "invited", invited_at: "2026-10-04T12:00:01Z" }), now)).toBe(true);
    expect(isOpenInvitation(row({ status: "invited", invited_at: "2026-10-04T12:00:00Z" }), now)).toBe(false);
    expect(isOpenInvitation(row({ status: "active", invited_at: "2026-10-10T12:00:00Z" }), now)).toBe(false);
    expect(closedBefore(now)).toBe("2026-10-04T12:00:00.000Z");
  });
});

describe("careTeam", () => {
  const owner = row({ id: "ade", profile_id: "ade", role: "owner", joined_at: "2024-02-14T10:00:00Z", invited_at: "2024-02-14T10:00:00Z" });
  const sam = row({ id: "sam", profile_id: "sam", invited_email: "sam@example.com", joined_at: "2024-02-16T10:00:00Z", invited_at: "2024-02-15T10:00:00Z" });
  const jo = row({ id: "jo", invited_email: "jo@example.com", status: "invited", invited_at: "2026-10-09T10:00:00Z" });
  const kit = row({ id: "kit", invited_email: "kit@example.com", status: "invited", invited_at: "2026-09-22T10:00:00Z" });
  const pat = row({ id: "pat", invited_email: "pat@example.com", status: "revoked", invited_at: "2024-03-03T10:00:00Z", declined_at: "2024-03-04T10:00:00Z", revoked_at: "2024-03-04T10:00:00Z" });
  const lee = row({ id: "lee", invited_email: "lee@example.com", status: "revoked", invited_at: "2025-01-03T10:00:00Z", revoked_at: "2025-01-05T10:00:00Z" });
  const gone = row({ id: "gone", profile_id: "gone", invited_email: "gone@example.com", status: "revoked", joined_at: "2025-01-01T10:00:00Z", revoked_at: "2025-06-01T10:00:00Z" });

  it("lists the owner first, then members as they joined", () => {
    expect(careTeam([sam, owner], now).people.map((m) => m.id)).toEqual(["ade", "sam"]);
  });

  it("splits invitations into waiting and past, with what became of each", () => {
    const team = careTeam([owner, sam, jo, kit, pat, lee, gone], now);
    expect(team.waiting.map((m) => m.id)).toEqual(["jo"]);
    expect(team.past.map((m) => [m.id, m.outcome])).toEqual([
      ["kit", "expired"],
      ["lee", "cancelled"],
      ["pat", "declined"],
    ]);
    expect(team.past[0].endedAt).toBe("2026-09-29T10:00:00.000Z");
  });

  it("counts members and open invitations against three places", () => {
    expect(placesLeft(careTeam([owner], now))).toBe(2);
    expect(placesLeft(careTeam([owner, sam, jo], now))).toBe(0);
    expect(placesLeft(careTeam([owner, sam, kit, pat], now))).toBe(1);
  });
});

describe("inviteErrorText", () => {
  it("explains a duplicate and a full household", () => {
    expect(inviteErrorText("23505")).toMatch(/already invited/);
    expect(inviteErrorText("23514")).toMatch(/up to 3 people/);
  });
});
