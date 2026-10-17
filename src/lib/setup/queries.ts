import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ACKNOWLEDGEMENT } from "@/lib/app/acknowledgement";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { getDogPlan } from "@/lib/plan/queries";
import { createClient } from "@/lib/supabase/server";
import { setupNeeded } from "./steps";

/** The acknowledgements the signed-in person has recorded. */
export const getAcknowledgements = cache(async (): Promise<{ kind: string; version: string }[]> => {
  const owner = await requireOwner();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("kind, version")
    .eq("profile_id", owner.userId)
    .eq("kind", ACKNOWLEDGEMENT.kind);
  if (error) throw new Error(`Could not load the acknowledgement: ${error.message}`);
  return data ?? [];
});

/**
 * Sends anyone who has a dog with a care plan, and has not finished setup, to
 * setup. The Dog tab is left open so the plan can be entered first, and
 * Emergency is never held back.
 */
export async function requireSetup(): Promise<void> {
  const dog = await getMyDog();
  if (!dog) return;
  const plan = await getDogPlan(dog.id);
  const hasPlan = (plan?.items.length ?? 0) > 0;
  if (!hasPlan) return;
  if (setupNeeded({ hasPlan, acknowledged: await getAcknowledgements() })) redirect("/setup");
}
