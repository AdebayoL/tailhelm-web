"use server";

import { redirect } from "next/navigation";
import { ACKNOWLEDGEMENT } from "@/lib/app/acknowledgement";
import { requireOwner } from "@/lib/auth/session";
import { HOME_PATH } from "@/lib/auth/input";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

/** Records the acknowledgement with its date and wording version, which finishes setup. */
export async function acknowledge(form: FormData): Promise<void> {
  const owner = await requireOwner();
  if (form.get("agree") !== "yes") redirect("/setup?step=acknowledge&missing=1");
  const supabase = await createClient();
  const { error } = await supabase
    .from("consents")
    .insert({ profile_id: owner.userId, kind: ACKNOWLEDGEMENT.kind, version: ACKNOWLEDGEMENT.version });
  // Already recorded, for example from another device: setup is done either way.
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error("[setup] acknowledgement failed", { code: error.code, message: error.message });
    redirect("/setup?step=acknowledge&failed=1");
  }
  redirect(HOME_PATH);
}
