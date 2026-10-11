"use client";

import { useActionState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { Field, NotSaved, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { type EventState, addStressEvent } from "./actions";

/** Plan a stressful day, such as grooming or fireworks: what it is and its dates. */
export function StressEventForm({ dogId, today }: { dogId: string; today: string }) {
  const [state, action, pending] = useActionState<EventState, FormData>(addStressEvent, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    <form key={state.savedAt ?? 0} action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <Field id="event-title" label="What is it?" hint="For example, grooming, kennels or fireworks night." error={err("title")}>
        <input
          id="event-title"
          name="title"
          defaultValue={was("title")}
          maxLength={80}
          aria-invalid={err("title") ? true : undefined}
          aria-describedby={describedBy("event-title", { hint: true, error: err("title") })}
          className="inp"
        />
      </Field>
      <DateParts name="starts_on" legend="Starts on" error={err("starts_on")} defaultValue={was("starts_on") || today} />
      <DateParts
        name="ends_on"
        legend="Ends on"
        optional
        hint="Leave blank for one day. For example, 14 10 2026"
        error={err("ends_on")}
        defaultValue={was("ends_on")}
      />
      {state.failed && <NotSaved />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Add this day"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
