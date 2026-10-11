"use client";

import { useActionState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { NotSaved, RadioGroup } from "@/app/_components/form";
import { addCondition, type PlanFormState } from "./plan-actions";

export type VariantOption = { key: string; label: string; definition: string | null };

/** The condition the vet diagnosed, its type and, if known, when. */
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
  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <input type="hidden" name="condition_key" value={conditionKey} />
      <RadioGroup
        name="variant"
        legend={`Which type of ${conditionName} did your vet diagnose?`}
        options={variants.map((v) => ({
          value: v.key,
          label: (
            <span className="stack-4" style={{ padding: "4px 0" }}>
              <span className="w6">{v.label}</span>
              {v.definition && <span className="ty-sm c2">{v.definition}</span>}
            </span>
          ),
        }))}
        error={state.errors?.variant}
      />
      <DateParts name="diagnosed_on" legend="Date of diagnosis" optional error={state.errors?.diagnosed_on} />
      {state.failed && <NotSaved />}
      <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
        {pending && <span className="spin" aria-hidden="true" />}
        {pending ? "Saving…" : `Add ${conditionName}`}
      </button>
    </form>
  );
}
