import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { emergencyCalls } from "@/lib/dogs/hours";
import { telHref } from "@/lib/dogs/input";
import { getMyDog } from "@/lib/dogs/queries";
import { getCaptures } from "@/lib/happening/queries";
import { formatDate, isEmergencyPlan } from "@/lib/plan/input";
import { getDogPlan } from "@/lib/plan/queries";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";
import { OwnerOnly } from "../_components/owner-only";
import { PageStatus } from "../_components/page";
import { Timer, type TimerData } from "./timer";

export const metadata: Metadata = { title: "Happening now · Tailhelm" };

/**
 * Happening now: the timer from the moment of the tap, the vet's numbers,
 * and "It has stopped". Nothing else asks anything of the owner. The page is
 * kept on the phone, so it opens and keeps time with no signal.
 */
export default function HappeningNowPage() {
  return (
    <div className="hn">
      <OwnerOnly />
      <PageStatus quiet />
      <Suspense fallback={<Timer data={null} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  if (!dog) return <Timer data={null} noDog />;
  const now = new Date();
  const [plan, names, timeZone, { running }] = await Promise.all([
    getDogPlan(dog.id),
    householdNames(dog.id),
    getTimeZone(owner.userId),
    getCaptures(dog.id, now),
  ]);
  const pack = plan ? getPack(plan.condition.condition_key) : null;
  const { first, second, why } = emergencyCalls(
    { name: dog.vet_name, phone: dog.vet_phone, hours: dog.vet_hours },
    { name: dog.out_of_hours_name, phone: dog.out_of_hours_phone, hours: dog.out_of_hours_hours },
    now,
    timeZone,
  );
  const emergencyPlan = plan?.items.find((i) => isEmergencyPlan(i) && i.vet_instructions) ?? null;
  const nameOf = (profile: string | null) => (profile && names[profile]) ?? "someone in the household";
  const data: TimerData = {
    dogId: dog.id,
    dogName: dog.name,
    timeZone,
    calls: [first, second].flatMap((c) => (c ? [{ ...c, href: telHref(c.phone) }] : [])),
    why,
    // Only what the pack publishes, with its citation behind it. Addison's publishes none, so its timer only counts.
    thresholds: (pack?.happeningNow?.thresholds ?? []).map(({ key, afterMinutes, ownerWording }) => ({ key, afterMinutes, ownerWording })),
    running: running && {
      id: running.id,
      startedAt: running.started_at,
      by: running.recorded_by === owner.userId ? null : nameOf(running.recorded_by),
    },
    plan: emergencyPlan && {
      words: emergencyPlan.vet_instructions ?? "",
      provenance: [
        emergencyPlan.set_by_vet_on && `Set by vet ${formatDate(emergencyPlan.set_by_vet_on)}`,
        `entered by ${emergencyPlan.created_by === owner.userId ? "you" : nameOf(emergencyPlan.created_by)}`,
      ]
        .filter(Boolean)
        .join(" · ")
        .replace(/^entered/, "Entered"),
    },
  };
  return <Timer data={data} />;
}
