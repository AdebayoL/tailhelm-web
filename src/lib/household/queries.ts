import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "./input";

/** The dog's household: members and open invitations. Row-level security limits it to members. */
export async function getHousehold(dogId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, profile_id, role, invited_email, status, invited_at")
    .eq("dog_id", dogId)
    .neq("status", "revoked")
    .order("invited_at");
  if (error) throw new Error(`Could not load the household: ${error.message}`);
  return (data ?? []) as Member[];
}

export type Invitation = { id: string; dog_id: string; dog_name: string; invited_by: string | null; invited_at: string };

/** Open invitations to the signed-in person's email address. */
export async function getMyInvitations(): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invitations");
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return (data ?? []) as Invitation[];
}

/** The signed-in person's display name, if they set one. */
export async function getMyName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle<{ display_name: string | null }>();
  return data?.display_name ?? null;
}
