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
