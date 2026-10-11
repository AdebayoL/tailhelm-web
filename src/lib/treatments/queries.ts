import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LastInjection = {
  id: string;
  given_on: string;
  amount: number | null;
  unit: string | null;
  given_by: string | null;
  given_by_profile: string | null;
  site: string | null;
  vial_id: string | null;
};

export type Vial = {
  id: string;
  batch: string | null;
  expires_on: string | null;
  opened_on: string | null;
};

export type InjectionInfo = { last: LastInjection | null; vials: Vial[] };

/** For each injection on a cycle: the most recent one logged, and the vials recorded for it. */
export async function getInjectionInfo(
  itemIds: string[],
): Promise<Record<string, InjectionInfo>> {
  const info: Record<string, InjectionInfo> = Object.fromEntries(
    itemIds.map((id) => [id, { last: null, vials: [] }]),
  );
  if (itemIds.length === 0) return info;
  const supabase = await createClient();
  const [treatments, vials] = await Promise.all([
    supabase
      .from("treatments")
      .select(
        "id, plan_item_id, given_on, amount, unit, given_by, given_by_profile, site, vial_id",
      )
      .in("plan_item_id", itemIds)
      .eq("slot", "injection")
      .order("given_on", { ascending: false })
      .limit(itemIds.length * 3),
    supabase
      .from("vials")
      .select("id, plan_item_id, batch, expires_on, opened_on")
      .in("plan_item_id", itemIds)
      .order("opened_on", { ascending: false, nullsFirst: false })
      .limit(itemIds.length * 5),
  ]);
  if (treatments.error)
    throw new Error(`Could not load injections: ${treatments.error.message}`);
  if (vials.error)
    throw new Error(`Could not load vials: ${vials.error.message}`);

  for (const t of (treatments.data ?? []) as (LastInjection & {
    plan_item_id: string;
  })[]) {
    const entry = info[t.plan_item_id];
    if (entry && !entry.last)
      entry.last = {
        ...t,
        amount: t.amount === null ? null : Number(t.amount),
      };
  }
  for (const v of (vials.data ?? []) as (Vial & { plan_item_id: string })[])
    info[v.plan_item_id]?.vials.push(v);
  return info;
}

export type LastTick = { plan_item_id: string; given_at: string; given_on: string; given_by: string | null; given_by_profile: string | null };

/** The latest record of each plan item being given, for the emergency card. */
export async function getLastGiven(itemIds: string[]): Promise<Record<string, LastTick>> {
  if (itemIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("plan_item_id, given_at, given_on, given_by, given_by_profile")
    .in("plan_item_id", itemIds)
    .order("given_at", { ascending: false })
    .limit(itemIds.length * 6);
  if (error) throw new Error(`Could not load the last doses: ${error.message}`);
  const last: Record<string, LastTick> = {};
  for (const t of (data ?? []) as LastTick[]) last[t.plan_item_id] ??= t;
  return last;
}

/** The days each injection on a cycle was given, from a date on, for the weight chart. */
export async function getInjectionDates(itemIds: string[], from: string): Promise<string[]> {
  if (itemIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("given_on")
    .in("plan_item_id", itemIds)
    .eq("slot", "injection")
    .gte("given_on", from)
    .order("given_on");
  if (error) throw new Error(`Could not load injection dates: ${error.message}`);
  return [...new Set(((data ?? []) as { given_on: string }[]).map((t) => t.given_on))];
}
