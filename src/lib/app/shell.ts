import "server-only";
import { cache } from "react";
import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { getHousehold, getMyName } from "@/lib/household/queries";
import { getDogPlan } from "@/lib/plan/queries";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { conditionName, conditionShortName } from "@/packs/names";
import { joinNames, otherNames } from "./words";

export type Shell = {
  dog: { name: string; condition: string | null; conditionShort: string | null } | null;
  me: { name: string; role: "Owner" | "Member" };
  /** The other people in the household, as "Sam" or "Sam and Kit"; empty when there are none. */
  shared: string;
  /** The time this page was read, on the signed-in person's clock. */
  at: string;
  timeZone: string;
};

/** What the frame around every signed-in screen shows: the dog, who is signed in, and how current the page is. */
export const getShell = cache(async (): Promise<Shell> => {
  const owner = await requireOwner();
  const [dog, myName, timeZone] = await Promise.all([getMyDog(), getMyName(owner.userId), getTimeZone(owner.userId)]);
  const [plan, names, members] = dog
    ? await Promise.all([getDogPlan(dog.id), householdNames(dog.id), getHousehold(dog.id)])
    : [null, {} as Record<string, string>, []];
  const key = plan?.condition.condition_key ?? null;
  // Names cover everyone who ever recorded anything; only people still in the household share it.
  const current = Object.fromEntries(
    members.filter((m) => m.status === "active" && m.profile_id && names[m.profile_id]).map((m) => [m.profile_id as string, names[m.profile_id as string]]),
  );
  return {
    dog: dog && {
      name: dog.name,
      condition: key && conditionName(key),
      conditionShort: key && conditionShortName(key),
    },
    me: {
      name: myName ?? owner.email?.split("@")[0] ?? "You",
      role: members.find((m) => m.profile_id === owner.userId)?.role === "member" ? "Member" : "Owner",
    },
    shared: joinNames(otherNames(current, owner.userId)),
    at: toLocal(new Date(), timeZone).time,
    timeZone,
  };
});
