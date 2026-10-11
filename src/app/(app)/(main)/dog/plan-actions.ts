"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/session";
import { type FieldErrors, parseConditionForm, parsePlanItemForm } from "@/lib/plan/input";
import { getPack } from "@/packs/registry";
import { createClient } from "@/lib/supabase/server";

export type PlanFormState = {
  errors?: FieldErrors;
  failed?: boolean;
  savedAt?: number;
  /** What was typed, returned with errors so the form keeps it. */
  values?: Record<string, string>;
  times?: string[];
};

function typed(form: FormData): Pick<PlanFormState, "values" | "times"> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k !== "times" && typeof v === "string") values[k] = v;
  return { values, times: form.getAll("times").map(String) };
}

/** Adds the condition to the dog, recording the pack version in use so later rule changes are traceable. */
export async function addCondition(_state: PlanFormState, form: FormData): Promise<PlanFormState> {
  await requireOwner();
  const parsed = parseConditionForm(form);
  if (!parsed.ok) return { errors: parsed.errors };
  const pack = getPack(parsed.value.condition_key);
  if (!pack) return { errors: { condition_key: "Choose a condition." } };

  const supabase = await createClient();
  const { error } = await supabase.from("dog_conditions").insert({
    dog_id: String(form.get("dog_id") ?? ""),
    condition_key: parsed.value.condition_key,
    pack_version: pack.version,
    variant: parsed.value.variant,
    diagnosed_on: parsed.value.diagnosed_on,
  });
  if (error) {
    console.error("[plan] add condition failed", { code: error.code, message: error.message });
    return { failed: true };
  }
  refresh();
  return { savedAt: Date.now() };
}

/**
 * Adds a medicine exactly as the vet prescribed it. A change to an existing
 * medicine is a new plan item that supersedes the old one, which is retired,
 * so the history of what the vet set is never overwritten.
 */
export async function addPlanItem(_state: PlanFormState, form: FormData): Promise<PlanFormState> {
  await requireOwner();
  const supabase = await createClient();
  const conditionId = String(form.get("dog_condition_id") ?? "");
  const { data: condition, error: conditionError } = await supabase
    .from("dog_conditions")
    .select("id, condition_key, variant")
    .eq("id", conditionId)
    .maybeSingle<{ id: string; condition_key: string; variant: string | null }>();
  if (conditionError || !condition) {
    console.error("[plan] condition lookup failed", { code: conditionError?.code, message: conditionError?.message });
    return { failed: true };
  }

  const parsed = parsePlanItemForm(form, condition.condition_key, condition.variant);
  if (!parsed.ok) return { errors: parsed.errors, ...typed(form) };

  const supersedes = String(form.get("supersedes_id") ?? "") || null;
  const { error } = await supabase
    .from("plan_items")
    .insert({ ...parsed.value, dog_condition_id: condition.id, supersedes_id: supersedes });
  if (error) {
    console.error("[plan] add item failed", { code: error.code, message: error.message });
    return { failed: true, ...typed(form) };
  }
  if (supersedes) {
    const { error: retireError } = await supabase
      .from("plan_items")
      .update({ active: false })
      .eq("id", supersedes)
      .eq("dog_condition_id", condition.id);
    if (retireError) console.error("[plan] retire superseded failed", { code: retireError.code, message: retireError.message });
  }
  refresh();
  return { savedAt: Date.now() };
}

/** Takes a medicine off the plan. The row stays, so its history is kept. */
export async function retirePlanItem(form: FormData): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_items")
    .update({ active: false })
    .eq("id", String(form.get("plan_item_id") ?? ""));
  if (error) console.error("[plan] retire failed", { code: error.code, message: error.message });
  refresh();
}
