import "server-only";
import { addDays } from "@/engine/time";
import { PlanSchedule } from "@/engine/schedule";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Tick } from "@/lib/today/today";
import { EMAIL_KINDS, PUSH_KINDS, USUAL_GIVER_DAYS, type Notice, type NoticeKind, usualGiver } from "./due";
import type { AnchorFact, PlanItemFact } from "./reconcile";

/**
 * Everything the scheduler needs to know about every active dog's household
 * at once: who is in it, how a reminder can reach each of them, and each
 * condition's plan. Read with the secret key, so it is server only.
 */

export type Person = { id: string; email: string | null; timezone: string; email_reminders: boolean };
export type Phones = { count: number; lastConfirmed: string | null };
export type Channel = "push" | "email";

export type DogPlan = {
  id: string;
  name: string;
  owner: string | null;
  /** The owner's clock, which the dog's reminders follow. */
  timeZone: string;
  members: string[];
  conditions: { id: string; items: PlanItemFact[]; anchors: AnchorFact[] }[];
};

export type Households = {
  dogs: DogPlan[];
  people: Map<string, Person>;
  phones: Map<string, Phones>;
  /** People with email reminders on and an address to send them to. */
  emailable: Set<string>;
  ticks: Tick[];
};

/** How a reminder of this kind can reach this person: by notification, by email, both or neither. */
export function channelsFor(h: Households, person: string, kind: NoticeKind): Channel[] {
  const channels: Channel[] = [];
  if (PUSH_KINDS.has(kind) && (h.phones.get(person)?.count ?? 0) > 0) channels.push("push");
  if (EMAIL_KINDS.has(kind) && h.emailable.has(person)) channels.push("email");
  return channels;
}

/** The people in the dog's household a reminder can reach at all. */
export function reachable(h: Households, dog: DogPlan): string[] {
  return dog.members.filter((p) => (h.phones.get(p)?.count ?? 0) > 0 || h.emailable.has(p));
}

/** Who in the dog's household a reminder goes to. An escalation leaves out the person who usually gives that dose. */
export function audience(h: Households, dog: DogPlan, notice: Notice): string[] {
  const people = reachable(h, dog);
  if (!notice.escalates) return people;
  const giver = usualGiver(h.ticks, notice.escalates.itemId, notice.escalates.slot, dog.owner);
  return people.filter((p) => p !== giver);
}

type Member = { dog_id: string; profile_id: string; role: string };
type Item = { id: string; product: string | null; schedule_json: unknown; dog_condition_id: string; created_at: string };
type Anchor = { dog_condition_id: string; anchored_on: string; cycle_no: number };

/** Ticks are read from this many days back: enough for who usually gives a dose, and for yesterday's reconciliation. */
const TICK_DAYS = USUAL_GIVER_DAYS + 1;

export async function loadHouseholds(admin: AdminClient, now: Date, ready: { push: boolean; email: boolean }): Promise<Households> {
  const h: Households = { dogs: [], people: new Map(), phones: new Map(), emailable: new Set(), ticks: [] };
  const { data: memberRows, error: membersError } = await admin
    .from("household_members")
    .select("dog_id, profile_id, role, dogs!inner(status)")
    .eq("status", "active")
    .eq("dogs.status", "active");
  if (membersError) throw new Error(`Could not load households: ${membersError.message}`);
  const members = (memberRows ?? []) as Member[];
  const profileIds = [...new Set(members.map((m) => m.profile_id))];
  if (profileIds.length === 0) return h;

  const [subs, people] = await Promise.all([
    ready.push
      ? admin.from("push_subscriptions").select("profile_id, last_test_ok_at").in("profile_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("profiles").select("id, email, timezone, email_reminders").in("id", profileIds),
  ]);
  if (subs.error ?? people.error) throw new Error(`Could not load people: ${(subs.error ?? people.error)!.message}`);
  for (const p of (people.data ?? []) as Person[]) h.people.set(p.id, p);
  for (const s of (subs.data ?? []) as { profile_id: string; last_test_ok_at: string | null }[]) {
    const phones = h.phones.get(s.profile_id) ?? { count: 0, lastConfirmed: null };
    phones.count++;
    if (s.last_test_ok_at && (!phones.lastConfirmed || s.last_test_ok_at > phones.lastConfirmed)) phones.lastConfirmed = s.last_test_ok_at;
    h.phones.set(s.profile_id, phones);
  }
  if (ready.email) {
    for (const p of h.people.values()) if (p.email_reminders && p.email?.includes("@")) h.emailable.add(p.id);
  }

  const dogIds = [...new Set(members.map((m) => m.dog_id))];
  const [dogs, conditions] = await Promise.all([
    admin.from("dogs").select("id, name").in("id", dogIds),
    admin.from("dog_conditions").select("id, dog_id").in("dog_id", dogIds),
  ]);
  const failed = dogs.error ?? conditions.error;
  if (failed) throw new Error(`Could not load dogs: ${failed.message}`);
  const conditionRows = (conditions.data ?? []) as { id: string; dog_id: string }[];
  const conditionIds = conditionRows.map((c) => c.id);

  const utcToday = now.toISOString().slice(0, 10);
  const [items, anchors] = conditionIds.length
    ? await Promise.all([
        admin
          .from("plan_items")
          .select("id, product, schedule_json, dog_condition_id, created_at")
          .in("dog_condition_id", conditionIds)
          .eq("active", true),
        admin.from("anchors").select("dog_condition_id, anchored_on, cycle_no").in("dog_condition_id", conditionIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (items.error ?? anchors.error) throw new Error(`Could not load plans: ${(items.error ?? anchors.error)!.message}`);
  const itemRows = (items.data ?? []) as Item[];
  const itemIds = itemRows.map((i) => i.id);
  const ticks = itemIds.length
    ? await admin
        .from("treatments")
        .select("id, plan_item_id, given_on, slot, extra_no, given_at, given_by_profile")
        .in("plan_item_id", itemIds)
        .gte("given_on", addDays(utcToday, -TICK_DAYS))
        .lte("given_on", addDays(utcToday, 2))
    : { data: [], error: null };
  if (ticks.error) throw new Error(`Could not load ticks: ${ticks.error.message}`);
  h.ticks = (ticks.data ?? []) as Tick[];

  for (const dog of (dogs.data ?? []) as { id: string; name: string }[]) {
    const household = members.filter((m) => m.dog_id === dog.id);
    const owner = household.find((m) => m.role === "owner")?.profile_id ?? null;
    h.dogs.push({
      id: dog.id,
      name: dog.name,
      owner,
      timeZone: (owner && h.people.get(owner)?.timezone) || "Europe/London",
      members: household.map((m) => m.profile_id),
      conditions: conditionRows
        .filter((c) => c.dog_id === dog.id)
        .map((c) => ({
          id: c.id,
          items: itemRows
            .filter((i) => i.dog_condition_id === c.id)
            .flatMap((i) => {
              const schedule = PlanSchedule.safeParse(i.schedule_json);
              return schedule.success ? [{ id: i.id, product: i.product, schedule_json: schedule.data, createdAt: i.created_at }] : [];
            }),
          anchors: ((anchors.data ?? []) as Anchor[])
            .filter((a) => a.dog_condition_id === c.id)
            .map((a) => ({ anchoredOn: a.anchored_on, cycleNo: a.cycle_no })),
        })),
    });
  }
  return h;
}
