import "server-only";
import { addDays, toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { type Dog, getMyDog } from "@/lib/dogs/queries";
import { type DogPlan, getDogPlan } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";
import { type InjectionInfo, getInjectionInfo } from "@/lib/treatments/queries";
import { type Tick, type TodayInput } from "./today";

export type TodayData = {
  dog: Dog;
  plan: DogPlan | null;
  input: TodayInput;
  injections: Record<string, InjectionInfo>;
};

/** The signed-in owner's time zone; every member sees the dog's day on their own clock. */
export async function getTimeZone(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle<{ timezone: string }>();
  return data?.timezone ?? "Europe/London";
}

export async function householdNames(
  dogId: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("household_names", { dog: dogId });
  if (error) throw new Error(`Could not load the household: ${error.message}`);
  return Object.fromEntries(
    ((data ?? []) as { profile_id: string; name: string }[]).map((r) => [
      r.profile_id,
      r.name,
    ]),
  );
}

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
  if (!plan || plan.items.length === 0)
    return { dog, plan, input, injections: {} };

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
  return { dog, plan, input, injections };
}
