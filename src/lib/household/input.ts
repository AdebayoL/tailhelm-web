import { parseEmail } from "@/lib/auth/input";

/**
 * The household: up to three people who care for the dog, with equal rights
 * to log and read. Only the owner invites and removes.
 */

export const HOUSEHOLD_SIZE = 3;

export type Member = {
  id: string;
  profile_id: string | null;
  role: "owner" | "member";
  invited_email: string | null;
  status: "invited" | "active";
  invited_at: string;
};

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
export function placesLeft(members: Member[]): number {
  return Math.max(0, HOUSEHOLD_SIZE - members.length);
}

/** A database refusal turned into words for the owner. */
export function inviteErrorText(code: string | undefined): string {
  if (code === "23505") return "You have already invited this address.";
  if (code === "23514") return `A household has up to ${HOUSEHOLD_SIZE} people. Remove someone or cancel an invitation first.`;
  return "The invitation wasn’t saved. Try again in a minute.";
}
