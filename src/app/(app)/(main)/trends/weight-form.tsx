"use client";

import { useActionState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { Field, NotSaved, RadioGroup, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { type ResultState, logWeight } from "./actions";

/** Add a weight: what the scales said, whose scales, and the day. */
export function WeightForm({ conditionId, today, dogName }: { conditionId: string; today: string; dogName: string }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(logWeight, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    <form key={state.savedAt ?? 0} action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <Field id="weight-kg" label="Weight in kilograms" hint="As the scales showed it, such as 24.6." error={err("kg")}>
        <input
          id="weight-kg"
          name="kg"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={was("kg")}
          aria-invalid={err("kg") ? true : undefined}
          aria-describedby={describedBy("weight-kg", { hint: true, error: err("kg") })}
          className="inp tn"
          style={{ maxWidth: 160 }}
        />
      </Field>
      <RadioGroup
        name="scale"
        legend={`Where was ${dogName} weighed?`}
        options={[
          { value: "clinic", label: "On the clinic's scale" },
          { value: "home", label: "On a home scale" },
        ]}
        defaultValue={was("scale")}
        error={err("scale")}
      />
      <DateParts name="taken_on" legend="Day weighed" error={err("taken_on")} defaultValue={was("taken_on") || today} />
      <Field id="weight-note" label="Note" optional error={err("note")}>
        <input
          id="weight-note"
          name="note"
          maxLength={200}
          defaultValue={was("note")}
          aria-invalid={err("note") ? true : undefined}
          aria-describedby={describedBy("weight-note", { error: err("note") })}
          className="inp"
        />
      </Field>
      {state.failed && <NotSaved what="The weight" />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save weight"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
