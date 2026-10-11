"use client";

import { useActionState } from "react";
import { type ResultState, addNote } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/** Write a note about the dog, such as feeding or behaviour, for a day. */
export function NoteForm({ dogId, today }: { dogId: string; today: string }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(addNote, {});
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    // The key starts a fresh form after each save.
    <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <label className="flex flex-col gap-2 text-lg">
        Note
        <textarea
          name="text"
          rows={3}
          maxLength={1000}
          placeholder="Ate half of breakfast"
          defaultValue={was("text")}
          aria-invalid={!!err("text")}
          aria-describedby={err("text") ? "note-text-error" : undefined}
          className={field}
        />
        {err("text") && (
          <span id="note-text-error" className="font-semibold">
            {err("text")}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-2 text-lg">
        Day it is about
        <input
          type="date"
          name="on"
          max={today}
          defaultValue={was("on") || today}
          aria-invalid={!!err("on")}
          aria-describedby={err("on") ? "note-on-error" : undefined}
          className={field}
        />
        {err("on") && (
          <span id="note-on-error" className="font-semibold">
            {err("on")}
          </span>
        )}
      </label>
      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.failed ? "Saved." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}
