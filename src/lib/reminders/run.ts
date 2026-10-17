import "server-only";
import { emailConfig, deliverEmail } from "@/lib/email/send";
import type { Outcome } from "@/lib/notify/log";
import { addDays } from "@/engine/time";
import { PlanSchedule } from "@/engine/schedule";
import { pushConfig } from "@/lib/push/config";
import { deliver } from "@/lib/push/send";
import type { AdminClient } from "@/lib/supabase/admin";
import { type Tick, type TodayItem, buildToday } from "@/lib/today/today";
import { EMAIL_KINDS, PUSH_KINDS, USUAL_GIVER_DAYS, type Notice, dueNotices, usualGiver } from "./due";

type Counts = Partial<Record<Outcome, number>>;
export type RunSummary = { dogs: number; notices: number; push: Counts; email: Counts };

type Member = { dog_id: string; profile_id: string; role: string };
type Person = { id: string; email: string | null; timezone: string; email_reminders: boolean };
type Item = { id: string; product: string | null; schedule_json: unknown; dog_condition_id: string };

/**
 * One scheduler run: for every active dog with someone a reminder can reach,
 * work out what is due now on the owner's clock and send it to each person in
 * the household, by notification on their phones and, for the reminders the
 * spec emails, by email. A dose still missed hours later is passed to the
 * rest of the household (reminder layer 4). Safe to run as often as wanted, because each
 * reminder is logged and sent once per person per channel.
 */
export async function runReminders(admin: AdminClient, now: Date, appUrl: string): Promise<RunSummary> {
  const push = pushConfig();
  const email = emailConfig();
  if (!push && !email) throw new Error("Set the VAPID keys or RESEND_API_KEY");
  const summary: RunSummary = { dogs: 0, notices: 0, push: {}, email: {} };

  const { data: memberRows, error: membersError } = await admin
    .from("household_members")
    .select("dog_id, profile_id, role, dogs!inner(status)")
    .eq("status", "active")
    .eq("dogs.status", "active");
  if (membersError) throw new Error(`Could not load households: ${membersError.message}`);
  const members = (memberRows ?? []) as Member[];
  const profileIds = [...new Set(members.map((m) => m.profile_id))];
  if (profileIds.length === 0) return summary;

  const [subs, people] = await Promise.all([
    push ? admin.from("push_subscriptions").select("profile_id").in("profile_id", profileIds) : Promise.resolve({ data: [], error: null }),
    admin.from("profiles").select("id, email, timezone, email_reminders").in("id", profileIds),
  ]);
  if (subs.error ?? people.error) throw new Error(`Could not load people: ${(subs.error ?? people.error)!.message}`);
  const personOf = new Map(((people.data ?? []) as Person[]).map((p) => [p.id, p]));
  const pushable = new Set(((subs.data ?? []) as { profile_id: string }[]).map((s) => s.profile_id));
  const emailable = new Set(
    email ? [...personOf.values()].filter((p) => p.email_reminders && p.email?.includes("@")).map((p) => p.id) : [],
  );
  const reachable = (id: string) => pushable.has(id) || emailable.has(id);
  const dogIds = [...new Set(members.filter((m) => reachable(m.profile_id)).map((m) => m.dog_id))];
  if (dogIds.length === 0) return summary;

  const owners = members.filter((m) => m.role === "owner" && dogIds.includes(m.dog_id));
  const [dogs, conditions] = await Promise.all([
    admin.from("dogs").select("id, name").in("id", dogIds),
    admin.from("dog_conditions").select("id, dog_id").in("dog_id", dogIds),
  ]);
  const failed = dogs.error ?? conditions.error;
  if (failed) throw new Error(`Could not load dogs: ${failed.message}`);
  const conditionIds = ((conditions.data ?? []) as { id: string; dog_id: string }[]).map((c) => c.id);

  const send = async (person: string, dogId: string, notice: Notice) => {
    const sends: ["push" | "email", () => Promise<Outcome>][] = [];
    if (push && PUSH_KINDS.has(notice.kind) && pushable.has(person)) sends.push(["push", () => deliver(admin, push, person, dogId, notice)]);
    const address = personOf.get(person)?.email;
    if (email && address && EMAIL_KINDS.has(notice.kind) && emailable.has(person)) {
      sends.push(["email", () => deliverEmail(admin, email, { id: person, email: address }, dogId, notice, appUrl)]);
    }
    for (const [channel, go] of sends) {
      let outcome: Outcome;
      try {
        outcome = await go();
      } catch (error) {
        console.error("[reminders] send failed", { channel, kind: notice.kind, message: (error as Error).message });
        outcome = "failed";
      }
      summary[channel][outcome] = (summary[channel][outcome] ?? 0) + 1;
    }
  };

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
        .gte("given_on", addDays(utcToday, -USUAL_GIVER_DAYS))
        .lte("given_on", addDays(utcToday, 2))
    : { data: [], error: null };
  if (ticks.error) throw new Error(`Could not load ticks: ${ticks.error.message}`);

  for (const dog of (dogs.data ?? []) as { id: string; name: string }[]) {
    const owner = owners.find((o) => o.dog_id === dog.id);
    const timeZone = (owner && personOf.get(owner.profile_id)?.timezone) || "Europe/London";
    const people = members.filter((m) => m.dog_id === dog.id && reachable(m.profile_id)).map((m) => m.profile_id);
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
        // An escalation goes to the rest of the household, not the person who usually gives the dose.
        const giver = notice.escalates
          ? usualGiver((ticks.data ?? []) as Tick[], notice.escalates.itemId, notice.escalates.slot, owner?.profile_id ?? null)
          : null;
        const to = notice.escalates ? people.filter((p) => p !== giver) : people;
        if (to.length === 0) continue;
        summary.notices++;
        for (const person of to) await send(person, dog.id, notice);
      }
    }
  }
  return summary;
}
