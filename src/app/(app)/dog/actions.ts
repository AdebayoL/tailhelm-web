"use server";

import { refresh } from "next/cache";
import { type FieldErrors, parseDogProfile } from "@/lib/dogs/input";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type DogProfileState = { errors?: FieldErrors; failed?: boolean; savedAt?: number };

/** Adds the dog on first save, then updates it. Row-level security limits both to the owner's household. */
export async function saveDogProfile(_state: DogProfileState, form: FormData): Promise<DogProfileState> {
  await requireOwner();
  const parsed = parseDogProfile(form);
  if (!parsed.ok) return { errors: parsed.errors };

  const supabase = await createClient();
  let dogId = String(form.get("dog_id") ?? "");

  if (!dogId) {
    const { data, error } = await supabase.rpc("create_dog", { dog_name: parsed.profile.name });
    if (error || typeof data !== "string") {
      console.error("[dog] create failed", { code: error?.code, message: error?.message });
      return { failed: true };
    }
    dogId = data;
  }

  const { error } = await supabase.from("dogs").update(parsed.profile).eq("id", dogId);
  if (error) {
    console.error("[dog] update failed", { code: error.code, message: error.message });
    return { failed: true };
  }

  refresh();
  return { savedAt: Date.now() };
}
