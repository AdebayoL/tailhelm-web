"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { inviteErrorText, parseDisplayName, parseInviteForm } from "@/lib/household/input";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; savedAt?: number; value?: string };

/** The owner invites someone by email. Row-level security lets only the owner do this. */
export async function inviteMember(_state: FormState, form: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = parseInviteForm(form, owner.email);
  if (!parsed.ok) return { error: parsed.error, value: String(form.get("email") ?? "") };
  const supabase = await createClient();
  const { error } = await supabase.from("household_members").insert({
    dog_id: String(form.get("dog_id") ?? ""),
    invited_email: parsed.email,
    role: "member",
    status: "invited",
  });
  if (error) {
    console.error("[household] invite failed", { code: error.code, message: error.message });
    return { error: inviteErrorText(error.code), value: parsed.email };
  }
  refresh();
  return { savedAt: Date.now() };
}

/** The owner removes a member or cancels an invitation. Access ends at once. */
export async function removeMember(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("household_members")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", String(form.get("member_id") ?? ""))
    .eq("role", "member");
  if (error) console.error("[household] remove failed", { code: error.code, message: error.message });
  refresh();
}

export async function acceptInvitation(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { invitation: String(form.get("invitation_id") ?? "") });
  if (error) {
    console.error("[household] accept failed", { code: error.code, message: error.message });
    refresh();
    return;
  }
  redirect("/today");
}

export async function declineInvitation(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_invitation", { invitation: String(form.get("invitation_id") ?? "") });
  if (error) console.error("[household] decline failed", { code: error.code, message: error.message });
  refresh();
}

/** A member leaves the household. The owner cannot, so the dog always has one. */
export async function leaveHousehold(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_household", { dog: String(form.get("dog_id") ?? "") });
  if (error) {
    console.error("[household] leave failed", { code: error.code, message: error.message });
    refresh();
    return;
  }
  redirect("/today");
}

/** The name the household sees beside each tick, such as "Given at 08:04 by Sam". */
export async function saveDisplayName(_state: FormState, form: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = parseDisplayName(form);
  if (!parsed.ok) return { error: parsed.error, value: String(form.get("display_name") ?? "") };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.name }).eq("id", owner.userId);
  if (error) {
    console.error("[household] name failed", { code: error.code, message: error.message });
    return { error: "Your name wasn’t saved. Try again in a minute.", value: parsed.name };
  }
  refresh();
  return { savedAt: Date.now() };
}
