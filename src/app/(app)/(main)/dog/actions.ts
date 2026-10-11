"use server";

import { refresh } from "next/cache";
import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { type FieldErrors, parseDogProfile, parseDogVets } from "@/lib/dogs/input";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today/queries";

export type DogFormState = {
  errors?: FieldErrors;
  failed?: boolean;
  savedAt?: number;
  /** What was typed, returned with errors so the form keeps it. */
  values?: Record<string, string>;
};

function typed(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") values[k] = v;
  return values;
}

/** Adds the dog on first save, then updates its profile. Row-level security limits both to the household. */
export async function saveDogProfile(_state: DogFormState, form: FormData): Promise<DogFormState> {
  const owner = await requireOwner();
  const today = toLocal(new Date(), await getTimeZone(owner.userId)).date;
  const parsed = parseDogProfile(form, today);
  if (!parsed.ok) return { errors: parsed.errors, values: typed(form) };

  const supabase = await createClient();
  let dogId = String(form.get("dog_id") ?? "");

  if (!dogId) {
    const { data, error } = await supabase.rpc("create_dog", { dog_name: parsed.profile.name });
    if (error || typeof data !== "string") {
      console.error("[dog] create failed", { code: error?.code, message: error?.message });
      return { failed: true, values: typed(form) };
    }
    dogId = data;
  }

  const { error } = await supabase.from("dogs").update(parsed.profile).eq("id", dogId);
  if (error) {
    console.error("[dog] update failed", { code: error.code, message: error.message });
    return { failed: true, values: typed(form) };
  }

  refresh();
  return { savedAt: Date.now() };
}

/** Saves the dog's own vet and the out-of-hours service, with their opening hours. */
export async function saveDogVets(_state: DogFormState, form: FormData): Promise<DogFormState> {
  await requireOwner();
  const parsed = parseDogVets(form);
  if (!parsed.ok) return { errors: parsed.errors, values: typed(form) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("dogs")
    .update(parsed.vets)
    .eq("id", String(form.get("dog_id") ?? ""));
  if (error) {
    console.error("[dog] vets update failed", { code: error.code, message: error.message });
    return { failed: true, values: typed(form) };
  }
  refresh();
  return { savedAt: Date.now() };
}
