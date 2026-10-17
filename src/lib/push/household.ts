import "server-only";
import { PlanSchedule } from "@/engine/schedule";
import { type LocalDate, type LocalTime, toLocal } from "@/engine/time";
import { type PlanChange, planChangedNotice, tickedNotice } from "@/lib/reminders/due";
import { type TodayItem } from "@/lib/today/today";
import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import { pushConfig } from "./config";
import { deliver } from "./send";

/** Everyone else in the dog's household. */
async function othersThan(admin: AdminClient, dogId: string, by: string): Promise<string[]> {
  const { data, error } = await admin.from("household_members").select("profile_id").eq("dog_id", dogId).eq("status", "active");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { profile_id: string }[]).map((m) => m.profile_id).filter((p) => p !== by);
}

/** The name the household knows someone by. */
async function nameOf(admin: AdminClient, profileId: string): Promise<string> {
  const { data: me } = await admin.from("profiles").select("display_name, email").eq("id", profileId).single<{ display_name: string | null; email: string }>();
  return me?.display_name?.trim() || me?.email.split("@")[0] || "Someone in the household";
}

/**
 * Tells the rest of the household the moment a dose is ticked, so nobody gives
 * it twice. The message replaces that dose's reminder on their phones. Does
 * nothing when notifications are not set up; a failure here never affects the
 * tick itself.
 */
export async function tellHouseholdOfTick(tick: {
  planItemId: string;
  dogId: string;
  givenOn: LocalDate;
  slot: LocalTime;
  extraNo: number;
  givenAt: Date;
  by: string;
  timeZone: string;
}): Promise<void> {
  const admin = createAdminClient();
  const config = pushConfig();
  if (!admin || !config) return;
  try {
    const [dog, item, others] = await Promise.all([
      admin.from("dogs").select("name").eq("id", tick.dogId).single<{ name: string }>(),
      admin.from("plan_items").select("id, product, schedule_json").eq("id", tick.planItemId).single(),
      othersThan(admin, tick.dogId, tick.by),
    ]);
    if (dog.error || item.error) throw new Error((dog.error ?? item.error)!.message);
    if (others.length === 0) return;
    const by = await nameOf(admin, tick.by);
    const notice = tickedNotice({
      dogName: dog.data.name,
      item: item.data,
      date: tick.givenOn,
      slot: tick.slot,
      extraNo: tick.extraNo,
      by,
      at: toLocal(tick.givenAt, tick.timeZone).time,
      now: new Date(),
    });
    for (const person of others) await deliver(admin, config, person, tick.dogId, notice);
  } catch (error) {
    console.error("[push] could not tell the household of a tick", { message: (error as Error).message });
  }
}

type PlanRow = { id: string; product: string | null; schedule_json: unknown; dog_conditions: { dog_id: string; dogs: { name: string } } };

function asItem(row: PlanRow | undefined): TodayItem | null {
  const schedule = PlanSchedule.safeParse(row?.schedule_json);
  return row && schedule.success ? { id: row.id, product: row.product, schedule_json: schedule.data } : null;
}

/**
 * Tells the rest of the household the moment a medicine is added, replaced or
 * taken off the plan, because their calendar can take hours to show it. Does
 * nothing when notifications are not set up; a failure here never affects
 * the change itself.
 */
export async function tellHouseholdOfPlanChange(change: { itemId: string; wasId: string | null; removed: boolean; by: string }): Promise<void> {
  const admin = createAdminClient();
  const config = pushConfig();
  if (!admin || !config) return;
  try {
    const ids = [change.itemId, change.wasId].filter((id): id is string => !!id);
    const { data, error } = await admin
      .from("plan_items")
      .select("id, product, schedule_json, dog_conditions!inner(dog_id, dogs!inner(name))")
      .in("id", ids);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as PlanRow[];
    const row = rows.find((r) => r.id === change.itemId);
    const item = asItem(row);
    if (!row || !item) return;
    const was = asItem(rows.find((r) => r.id === change.wasId));
    const what: PlanChange = change.removed ? { kind: "removed", item } : was ? { kind: "replaced", item, was } : { kind: "added", item };
    const dogId = row.dog_conditions.dog_id;
    const others = await othersThan(admin, dogId, change.by);
    if (others.length === 0) return;
    const notice = planChangedNotice({ dogName: row.dog_conditions.dogs.name, by: await nameOf(admin, change.by), change: what, now: new Date() });
    if (!notice) return;
    for (const person of others) await deliver(admin, config, person, dogId, notice);
  } catch (error) {
    console.error("[push] could not tell the household of a plan change", { message: (error as Error).message });
  }
}
