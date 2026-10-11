import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "./input";

/**
 * Everyone who has been in the dog's household or invited to it, with what
 * became of each invitation. Row-level security limits it to members.
 */
export const getHouseholdHistory = cache(async (dogId: string): Promise<Member[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, profile_id, role, invited_email, status, invited_at, joined_at, declined_at, revoked_at")
    .eq("dog_id", dogId)
    .order("invited_at");
  if (error) throw new Error(`Could not load the household: ${error.message}`);
  return (data ?? []) as Member[];
});

/** The dog's household: members and invitations not yet answered. */
export const getHousehold = cache(async (dogId: string): Promise<Member[]> =>
  (await getHouseholdHistory(dogId)).filter((m) => m.status !== "revoked"),
);

/** When each person last recorded a dose, a check, a note or an event, by profile. */
export const getLastRecorded = cache(async (dogId: string): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("household_last_recorded", { dog: dogId });
  if (error) throw new Error(`Could not load who last recorded: ${error.message}`);
  return Object.fromEntries(((data ?? []) as { profile_id: string; recorded_at: string }[]).map((r) => [r.profile_id, r.recorded_at]));
});

export type Invitation = { id: string; dog_id: string; dog_name: string; invited_by: string | null; invited_at: string };

/** Open invitations to the signed-in person's email address. */
export async function getMyInvitations(): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invitations");
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return (data ?? []) as Invitation[];
}

/** The signed-in person's display name, if they set one. */
export const getMyName = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle<{ display_name: string | null }>();
  return data?.display_name ?? null;
});
