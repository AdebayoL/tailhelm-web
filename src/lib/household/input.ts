import { parseEmail } from "@/lib/auth/input";

/**
 * The household: up to three people who care for the dog, with equal rights
 * to log and read. Only the owner invites and removes.
 */

export const HOUSEHOLD_SIZE = 3;

/** An invitation can be accepted for this many days after it is sent. */
export const INVITATION_DAYS = 7;

const DAY_MS = 86_400_000;

export type Member = {
  id: string;
  profile_id: string | null;
  role: "owner" | "member";
  invited_email: string | null;
  status: "invited" | "active" | "revoked";
  invited_at: string;
  joined_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
};

/** When an invitation stops being open. */
export function invitationExpires(invitedAt: string): Date {
  return new Date(Date.parse(invitedAt) + INVITATION_DAYS * DAY_MS);
}

/** An invitation that can still be accepted. */
export function isOpenInvitation(m: Pick<Member, "status" | "invited_at">, now: Date): boolean {
  return m.status === "invited" && invitationExpires(m.invited_at) > now;
}

/** Invitations sent before this have closed. */
export function closedBefore(now: Date): string {
  return new Date(now.getTime() - INVITATION_DAYS * DAY_MS).toISOString();
}

export type PastInvitation = Member & { outcome: "declined" | "expired" | "cancelled"; endedAt: string | null };

export type CareTeam = {
  /** Owner first, then members in the order they joined. */
  people: Member[];
  /** Invitations still open, oldest first. */
  waiting: Member[];
  /** Invitations declined, cancelled or never answered, newest first. */
  past: PastInvitation[];
};

/**
 * The household as the care team screen shows it. A past invitation is one
 * that never became a membership; a member who was removed or left is not one.
 */
export function careTeam(rows: Member[], now: Date): CareTeam {
  const people = rows
    .filter((m) => m.status === "active")
    .sort((a, b) => (a.role === b.role ? (a.joined_at ?? a.invited_at).localeCompare(b.joined_at ?? b.invited_at) : a.role === "owner" ? -1 : 1));
  const waiting = rows.filter((m) => isOpenInvitation(m, now));
  const past: PastInvitation[] = [];
  for (const m of rows) {
    if (m.role !== "member" || !m.invited_email) continue;
    if (m.declined_at) past.push({ ...m, outcome: "declined", endedAt: m.declined_at });
    else if (m.status === "invited" && !isOpenInvitation(m, now)) past.push({ ...m, outcome: "expired", endedAt: invitationExpires(m.invited_at).toISOString() });
    else if (m.status === "revoked" && !m.profile_id) past.push({ ...m, outcome: "cancelled", endedAt: m.revoked_at });
  }
  past.sort((a, b) => b.invited_at.localeCompare(a.invited_at));
  return { people, waiting, past };
}

export function parseInviteForm(
  form: FormData,
  myEmail: string | null,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = parseEmail(form.get("email"));
  if (!email) return { ok: false, error: "Enter their email address, such as sam@example.com." };
  if (myEmail && email === myEmail.toLowerCase()) return { ok: false, error: "That is your own address. Enter theirs." };
  return { ok: true, email };
}

export function parseDisplayName(form: FormData): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(form.get("display_name") ?? "").trim();
  if (name.length === 0 || name.length > 40) return { ok: false, error: "Enter a name of up to 40 characters." };
  return { ok: true, name };
}

/** Places left in the household, counting open invitations. */
export function placesLeft(team: Pick<CareTeam, "people" | "waiting">): number {
  return Math.max(0, HOUSEHOLD_SIZE - team.people.length - team.waiting.length);
}

/** A database refusal turned into words for the owner. */
export function inviteErrorText(code: string | undefined): string {
  if (code === "23505") return "You have already invited this address.";
  if (code === "23514") return `A household has up to ${HOUSEHOLD_SIZE} people. Remove someone or cancel an invitation first.`;
  return "The invitation wasn’t saved. Try again in a minute.";
}
