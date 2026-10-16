import "server-only";
import { addDays } from "@/engine/time";
import { PlanSchedule } from "@/engine/schedule";
import { pushConfig } from "@/lib/push/config";
import { type Outcome, deliver } from "@/lib/push/send";
import type { AdminClient } from "@/lib/supabase/admin";
import { type Tick, type TodayItem, buildToday } from "@/lib/today/today";
import { dueNotices } from "./due";

export type RunSummary = { dogs: number; notices: number } & Partial<Record<Outcome, number>>;

type Member = { dog_id: string; profile_id: string; role: string };
type Item = { id: string; product: string | null; schedule_json: unknown; dog_condition_id: string };

/**
 * One scheduler run: for every active dog with someone whose phone takes
 * notifications, work out what is due now on the owner's clock and send it
 * to each person in the household. Safe to run as often as wanted, because
 * each reminder is logged and sent once per person.
 */
export async function runReminders(admin: AdminClient, now: Date): Promise<RunSummary> {
  const config = pushConfig();
  if (!config) throw new Error("Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");

  const { data: subs, error: subsError } = await admin.from("push_subscriptions").select("profile_id");
  if (subsError) throw new Error(`Could not load phones: ${subsError.message}`);
  const reachable = new Set((subs ?? []).map((s: { profile_id: string }) => s.profile_id));
  const summary: RunSummary = { dogs: 0, notices: 0 };
  if (reachable.size === 0) return summary;

  const { data: memberRows, error: membersError } = await admin
    .from("household_members")
    .select("dog_id, profile_id, role, dogs!inner(status)")
    .eq("status", "active")
    .eq("dogs.status", "active");
  if (membersError) throw new Error(`Could not load households: ${membersError.message}`);
  const members = (memberRows ?? []) as Member[];
  const dogIds = [...new Set(members.filter((m) => reachable.has(m.profile_id)).map((m) => m.dog_id))];
  if (dogIds.length === 0) return summary;

  const owners = members.filter((m) => m.role === "owner" && dogIds.includes(m.dog_id));
  const [dogs, zones, conditions] = await Promise.all([
    admin.from("dogs").select("id, name").in("id", dogIds),
    admin.from("profiles").select("id, timezone").in("id", owners.map((o) => o.profile_id)),
    admin.from("dog_conditions").select("id, dog_id").in("dog_id", dogIds),
  ]);
  const failed = dogs.error ?? zones.error ?? conditions.error;
  if (failed) throw new Error(`Could not load dogs: ${failed.message}`);
  const conditionIds = ((conditions.data ?? []) as { id: string; dog_id: string }[]).map((c) => c.id);

  const utcToday = now.toISOString().slice(0, 10);
  const [items, anchors] = await Promise.all([
    admin.from("plan_items").select("id, product, schedule_json, dog_condition_id").in("dog_condition_id", conditionIds).eq("active", true),
    admin.from("anchors").select("dog_condition_id, anchored_on, cycle_no").in("dog_condition_id", conditionIds).order("cycle_no", { ascending: false }),
  ]);
  if (items.error ?? anchors.error) throw new Error(`Could not load plans: ${(items.error ?? anchors.error)!.message}`);
  const itemIds = ((items.data ?? []) as Item[]).map((i) => i.id);
  const ticks = itemIds.length
    ? await admin
        .from("treatments")
        .select("id, plan_item_id, given_on, slot, extra_no, given_at, given_by_profile")
        .in("plan_item_id", itemIds)
        .gte("given_on", addDays(utcToday, -2))
        .lte("given_on", addDays(utcToday, 2))
    : { data: [], error: null };
  if (ticks.error) throw new Error(`Could not load ticks: ${ticks.error.message}`);

  const zoneOf = new Map(((zones.data ?? []) as { id: string; timezone: string }[]).map((z) => [z.id, z.timezone]));
  for (const dog of (dogs.data ?? []) as { id: string; name: string }[]) {
    const owner = owners.find((o) => o.dog_id === dog.id);
    const timeZone = (owner && zoneOf.get(owner.profile_id)) || "Europe/London";
    const people = members.filter((m) => m.dog_id === dog.id && reachable.has(m.profile_id)).map((m) => m.profile_id);
    summary.dogs++;
    for (const condition of ((conditions.data ?? []) as { id: string; dog_id: string }[]).filter((c) => c.dog_id === dog.id)) {
      const planItems: TodayItem[] = ((items.data ?? []) as Item[])
        .filter((i) => i.dog_condition_id === condition.id)
        .flatMap((i) => {
          const schedule = PlanSchedule.safeParse(i.schedule_json);
          return schedule.success ? [{ id: i.id, product: i.product, schedule_json: schedule.data }] : [];
        });
      if (planItems.length === 0) continue;
      const anchor = ((anchors.data ?? []) as { dog_condition_id: string; anchored_on: string; cycle_no: number }[]).find(
        (a) => a.dog_condition_id === condition.id,
      );
      const today = buildToday({
        now,
        timeZone,
        me: "",
        items: planItems,
        ticks: (ticks.data ?? []) as Tick[],
        latestAnchor: anchor ? { anchoredOn: anchor.anchored_on, cycleNo: anchor.cycle_no } : undefined,
        names: {},
      });
      for (const notice of dueNotices(today, dog.name, timeZone, now)) {
        summary.notices++;
        for (const person of people) {
          try {
            const outcome = await deliver(admin, config, person, dog.id, notice);
            summary[outcome] = (summary[outcome] ?? 0) + 1;
          } catch (error) {
            console.error("[reminders] send failed", { kind: notice.kind, message: (error as Error).message });
            summary.failed = (summary.failed ?? 0) + 1;
          }
        }
      }
    }
  }
  return summary;
}
