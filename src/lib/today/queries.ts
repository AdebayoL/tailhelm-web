import "server-only";
import { cache } from "react";
import { addDays, toLocal, zonedTimeToInstant } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { type Dog, getMyDog } from "@/lib/dogs/queries";
import { type DogPlan, getDogPlan } from "@/lib/plan/queries";
import { signsType } from "@/lib/signs/signs";
import { createClient } from "@/lib/supabase/server";
import { getPack } from "@/packs/registry";
import { NOTE_KIND } from "@/lib/notes/input";
import { type InjectionInfo, getInjectionInfo } from "@/lib/treatments/queries";
import { PAST_DAYS } from "./past";
import { type PlannedEvent, type Tick, type TodayInput } from "./today";

export type QuickCheck = {
  id: string;
  taken_at: string;
  values_json: Record<string, boolean>;
  recorded_by: string | null;
};

export type TodayData = {
  dog: Dog;
  plan: DogPlan | null;
  input: TodayInput;
  injections: Record<string, InjectionInfo>;
  /** Today's quick checks on the owner's clock, latest first. */
  checks: QuickCheck[];
  /** Who added each planned event, for the undo link. */
  eventOwners: Record<string, string | null>;
};

/** The signed-in owner's time zone; every member sees the dog's day on their own clock. */
export const getTimeZone = cache(async (userId: string): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  return data?.timezone ?? "Europe/London";
});

export const householdNames = cache(async (
  dogId: string,
): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("household_names", { dog: dogId });
  if (error) throw new Error(`Could not load the household: ${error.message}`);
  return Object.fromEntries(
    ((data ?? []) as { profile_id: string; name: string }[]).map((r) => [
      r.profile_id,
      r.name,
    ]),
  );
});

/** Everything the Today screen needs, read under row-level security. */
export async function getTodayData(): Promise<TodayData | null> {
  const owner = await requireOwner();
  const dog = await getMyDog();
  if (!dog) return null;
  const now = new Date();
  const [timeZone, plan, names] = await Promise.all([
    getTimeZone(owner.userId),
    getDogPlan(dog.id),
    householdNames(dog.id),
  ]);
  const input: TodayInput = {
    now,
    timeZone,
    me: owner.userId,
    items: plan?.items ?? [],
    ticks: [],
    names,
  };
  const events = await getStressEvents(dog.id, timeZone, now);
  input.events = events.map((e) => e.event);
  const eventOwners = Object.fromEntries(events.map((e) => [e.event.id, e.recordedBy]));
  if (!plan) return { dog, plan, input, injections: {}, checks: [], eventOwners };
  const signs = signsType(getPack(plan.condition.condition_key));
  const checks = signs ? await getQuickChecks(plan.condition.id, signs.key, timeZone, now) : [];
  if (plan.items.length === 0)
    return { dog, plan, input, injections: {}, checks, eventOwners };

  const supabase = await createClient();
  const today = toLocal(now, timeZone).date;
  const intervalIds = plan.items
    .filter((i) => i.schedule_json.kind === "interval")
    .map((i) => i.id);
  const [ticks, anchor, injections] = await Promise.all([
    supabase
      .from("treatments")
      .select(
        "id, plan_item_id, given_on, slot, extra_no, given_at, given_by_profile",
      )
      .in(
        "plan_item_id",
        plan.items.map((i) => i.id),
      )
      .gte("given_on", addDays(today, -1))
      .lte("given_on", addDays(today, 1)),
    supabase
      .from("anchors")
      .select("anchored_on, cycle_no")
      .eq("dog_condition_id", plan.condition.id)
      .order("cycle_no", { ascending: false })
      .limit(1)
      .maybeSingle<{ anchored_on: string; cycle_no: number }>(),
    getInjectionInfo(intervalIds),
  ]);
  if (ticks.error)
    throw new Error(`Could not load today's ticks: ${ticks.error.message}`);
  if (anchor.error)
    throw new Error(
      `Could not load the injection cycle: ${anchor.error.message}`,
    );

  input.ticks = (ticks.data ?? []) as Tick[];
  if (anchor.data)
    input.latestAnchor = {
      anchoredOn: anchor.data.anchored_on,
      cycleNo: anchor.data.cycle_no,
    };
  return { dog, plan, input, injections, checks, eventOwners };
}

export const STRESS_EVENT_KIND = "stressful_event";

/** Stressful events that end today or later, as dates on the owner's clock. */
async function getStressEvents(
  dogId: string,
  timeZone: string,
  now: Date,
): Promise<{ event: PlannedEvent; recordedBy: string | null }[]> {
  const supabase = await createClient();
  const dayStart = zonedTimeToInstant(toLocal(now, timeZone).date, "00:00", timeZone).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("id, note, started_at, ended_at, recorded_by")
    .eq("dog_id", dogId)
    .eq("kind", STRESS_EVENT_KIND)
    .or(`started_at.gte.${dayStart},ended_at.gte.${dayStart}`)
    .order("started_at");
  if (error) throw new Error(`Could not load planned events: ${error.message}`);
  return ((data ?? []) as { id: string; note: string | null; started_at: string; ended_at: string | null; recorded_by: string | null }[]).map(
    (e) => ({
      event: {
        id: e.id,
        title: e.note ?? "Stressful event",
        startsOn: toLocal(new Date(e.started_at), timeZone).date,
        endsOn: e.ended_at ? toLocal(new Date(e.ended_at), timeZone).date : null,
      },
      recordedBy: e.recorded_by,
    }),
  );
}

/** The quick checks saved since midnight on the owner's clock. */
async function getQuickChecks(
  conditionId: string,
  typeKey: string,
  timeZone: string,
  now: Date,
): Promise<QuickCheck[]> {
  const supabase = await createClient();
  const dayStart = zonedTimeToInstant(toLocal(now, timeZone).date, "00:00", timeZone);
  const { data, error } = await supabase
    .from("observations")
    .select("id, taken_at, values_json, recorded_by")
    .eq("dog_condition_id", conditionId)
    .eq("type_key", typeKey)
    .gte("taken_at", dayStart.toISOString())
    .order("taken_at", { ascending: false });
  if (error) throw new Error(`Could not load today's checks: ${error.message}`);
  return (data ?? []) as QuickCheck[];
}

/** The signs ticked, notes and stressful days for Past days, from the start of the window. */
export async function getPastRecords(
  dogId: string,
  conditionId: string | null,
  typeKey: string | null,
  timeZone: string,
  now: Date,
) {
  const supabase = await createClient();
  const from = zonedTimeToInstant(addDays(toLocal(now, timeZone).date, -(PAST_DAYS - 1)), "00:00", timeZone).toISOString();
  const [checks, notes, stress] = await Promise.all([
    conditionId && typeKey
      ? supabase
          .from("observations")
          .select("taken_at, values_json, recorded_by")
          .eq("dog_condition_id", conditionId)
          .eq("type_key", typeKey)
          .gte("taken_at", from)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("events")
      .select("id, started_at, note, recorded_by, created_at")
      .eq("dog_id", dogId)
      .eq("kind", NOTE_KIND)
      .gte("started_at", from),
    supabase
      .from("events")
      .select("id, note, started_at, ended_at")
      .eq("dog_id", dogId)
      .eq("kind", STRESS_EVENT_KIND)
      .or(`started_at.gte.${from},ended_at.gte.${from}`),
  ]);
  const failed = checks.error ?? notes.error ?? stress.error;
  if (failed) throw new Error(`Could not load past days: ${failed.message}`);
  return {
    checks: (checks.data ?? []) as { taken_at: string; values_json: Record<string, boolean>; recorded_by: string | null }[],
    notes: (notes.data ?? []) as { id: string; started_at: string; note: string; recorded_by: string | null; created_at: string | null }[],
    stress: (stress.data ?? []) as { id: string; note: string | null; started_at: string; ended_at: string | null }[],
  };
}
