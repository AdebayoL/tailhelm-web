import "server-only";
import { type LocalDate, type LocalTime, toLocal } from "@/engine/time";
import { tickedNotice } from "@/lib/reminders/due";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfig } from "./config";
import { deliver } from "./send";

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
    const [dog, item, members] = await Promise.all([
      admin.from("dogs").select("name").eq("id", tick.dogId).single<{ name: string }>(),
      admin.from("plan_items").select("id, product, schedule_json").eq("id", tick.planItemId).single(),
      admin.from("household_members").select("profile_id").eq("dog_id", tick.dogId).eq("status", "active"),
    ]);
    if (dog.error || item.error || members.error) throw new Error((dog.error ?? item.error ?? members.error)!.message);
    const others = ((members.data ?? []) as { profile_id: string }[]).map((m) => m.profile_id).filter((p) => p !== tick.by);
    if (others.length === 0) return;
    const { data: me } = await admin.from("profiles").select("display_name, email").eq("id", tick.by).single<{ display_name: string | null; email: string }>();
    const by = me?.display_name?.trim() || me?.email.split("@")[0] || "Someone in the household";
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
