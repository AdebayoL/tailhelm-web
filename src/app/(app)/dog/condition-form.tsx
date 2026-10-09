"use client";

import { useActionState } from "react";
import { addCondition, type PlanFormState } from "./plan-actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

export type VariantOption = { key: string; label: string; definition: string | null };

export function ConditionForm({
  dogId,
  conditionKey,
  conditionName,
  variants,
}: {
  dogId: string;
  conditionKey: string;
  conditionName: string;
  variants: VariantOption[];
}) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(addCondition, {});
  const variantError = state.errors?.variant;
  const dateError = state.errors?.diagnosed_on;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <input type="hidden" name="condition_key" value={conditionKey} />
      <fieldset className="flex flex-col gap-3" aria-describedby={variantError ? "variant-error" : undefined}>
        <legend className="mb-2 text-lg font-semibold">Which type of {conditionName} did your vet diagnose?</legend>
        {variants.map((v) => (
          <label key={v.key} className="flex min-h-12 items-start gap-3 rounded-lg border border-ink/30 px-4 py-3">
            <input type="radio" name="variant" value={v.key} required className="mt-1.5 size-5 accent-green" />
            <span className="flex flex-col">
              <span className="text-lg font-semibold">{v.label}</span>
              {v.definition && <span className="text-base">{v.definition}</span>}
            </span>
          </label>
        ))}
        {variantError && (
          <p id="variant-error" className="font-semibold">
            {variantError}
          </p>
        )}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="diagnosed_on" className="text-lg font-semibold">
          Date of diagnosis <span className="font-normal">(optional)</span>
        </label>
        <input
          id="diagnosed_on"
          name="diagnosed_on"
          type="date"
          aria-invalid={dateError ? true : undefined}
          aria-describedby={dateError ? "diagnosed_on-error" : undefined}
          className={field}
        />
        {dateError && (
          <p id="diagnosed_on-error" className="font-semibold">
            {dateError}
          </p>
        )}
      </div>
      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : `Add ${conditionName}`}
      </button>
    </form>
  );
}
