import "server-only";
import { cache } from "react";
import { type LocalDate, toLocal, zonedTimeToInstant } from "@/engine/time";
import { createClient } from "@/lib/supabase/server";

/** The household member whose Plus the dog is on, or null on free. Billing stays with them. */
export const plusPayer = cache(async (dogId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dog_plus_payer", { dog: dogId });
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  return typeof data === "string" ? data : null;
});

/** The signed-in person's own Plus, for the Dog tab: until when, and whether it renews. */
export async function myPlan(userId: string): Promise<{ endsAt: string | null; renews: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_status, plan_ends_at, renews")
    .eq("id", userId)
    .maybeSingle<{ plan_status: string; plan_ends_at: string | null; renews: boolean }>();
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  if (!data || data.plan_status !== "plus") return null;
  if (data.plan_ends_at && new Date(data.plan_ends_at).getTime() <= Date.now()) return null;
  return { endsAt: data.plan_ends_at, renews: data.renews };
}

/**
 * The signed-in person's place in the dog's household for the day-31 sheet:
 * whether they have already closed it, whether they own the household (only
 * the owner is offered Plus), and who the owner is, for everyone else.
 */
export async function day31Household(dogId: string, userId: string): Promise<{ seen: boolean; owner: boolean; ownerId: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("profile_id, role, day31_seen_at")
    .eq("dog_id", dogId)
    .eq("status", "active");
  if (error) throw new Error(`Could not load the household: ${error.message}`);
  const rows = (data ?? []) as { profile_id: string | null; role: string; day31_seen_at: string | null }[];
  const mine = rows.find((r) => r.profile_id === userId);
  const owner = rows.find((r) => r.role === "owner");
  return { seen: Boolean(mine?.day31_seen_at), owner: mine?.role === "owner", ownerId: owner?.profile_id ?? null };
}

/**
 * The day of the household's first record since the dog was added: a dose
 * ticked, a check, weight or result, a note or an event. Records typed in
 * for earlier days, such as an old lab report, don't count, so the month
 * starts when the household started.
 */
export async function firstRecordOn(
  dog: { id: string; created_at: string },
  conditionIds: string[],
  timeZone: string,
  now: Date,
): Promise<LocalDate | null> {
  const supabase = await createClient();
  // Every plan item, including ones the vet has since replaced, so their ticks count too.
  const items = conditionIds.length > 0 ? await supabase.from("plan_items").select("id").in("dog_condition_id", conditionIds) : null;
  if (items?.error) throw new Error(`Could not find the first record: ${items.error.message}`);
  const itemIds = (items?.data ?? []).map((i: { id: string }) => i.id);
  const start = zonedTimeToInstant(toLocal(new Date(dog.created_at), timeZone).date, "00:00", timeZone).toISOString();
  const end = now.toISOString();
  const none = Promise.resolve({ data: [] as Record<string, string>[], error: null });
  const [ticks, observations, events] = await Promise.all([
    itemIds.length > 0
      ? supabase.from("treatments").select("given_at").in("plan_item_id", itemIds).gte("given_at", start).lte("given_at", end).order("given_at").limit(1)
      : none,
    conditionIds.length > 0
      ? supabase.from("observations").select("taken_at").in("dog_condition_id", conditionIds).gte("taken_at", start).lte("taken_at", end).order("taken_at").limit(1)
      : none,
    supabase.from("events").select("started_at").eq("dog_id", dog.id).gte("started_at", start).lte("started_at", end).order("started_at").limit(1),
  ]);
  const failed = ticks.error ?? observations.error ?? events.error;
  if (failed) throw new Error(`Could not find the first record: ${failed.message}`);
  const firsts = [
    ...(ticks.data ?? []).map((r) => r.given_at),
    ...(observations.data ?? []).map((r) => r.taken_at),
    ...(events.data ?? []).map((r) => r.started_at),
  ].map((at) => toLocal(new Date(at), timeZone).date);
  return firsts.length > 0 ? firsts.sort()[0] : null;
}
