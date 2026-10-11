"use client";

import { useActionState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { Field, NotSaved, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { type ResultState, addNote } from "./actions";

/** Write a note about the dog, such as feeding or behaviour, for a day. */
export function NoteForm({ dogId, today }: { dogId: string; today: string }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(addNote, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    <form key={state.savedAt ?? 0} action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <Field id="note-text" label="Note" hint="Kept as a note for your vet, with your name and the time." error={err("text")}>
        <textarea
          id="note-text"
          name="text"
          rows={3}
          maxLength={1000}
          defaultValue={was("text")}
          aria-invalid={err("text") ? true : undefined}
          aria-describedby={describedBy("note-text", { hint: true, error: err("text") })}
          className="inp"
        />
      </Field>
      <DateParts name="on" legend="Day it is about" error={err("on")} defaultValue={was("on") || today} />
      {state.failed && <NotSaved what="The note" />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save note"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
