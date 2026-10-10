"use client";

import { useActionState } from "react";
import { type EventState, addStressEvent } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/** Plan a stressful event, such as kennels or fireworks: what it is and its dates. */
export function StressEventForm({ dogId, today }: { dogId: string; today: string }) {
  const [state, action, pending] = useActionState<EventState, FormData>(addStressEvent, {});
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    // The key starts a fresh form after each save.
    <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <label className="flex flex-col gap-2 text-lg">
        What is it?
        <input
          name="title"
          defaultValue={was("title")}
          maxLength={80}
          placeholder="Kennels"
          aria-invalid={!!err("title")}
          aria-describedby={err("title") ? "event-title-error" : undefined}
          className={field}
        />
        {err("title") && (
          <span id="event-title-error" className="font-semibold">
            {err("title")}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-2 text-lg">
        Starts on
        <input
          type="date"
          name="starts_on"
          min={today}
          defaultValue={was("starts_on") || today}
          aria-invalid={!!err("starts_on")}
          aria-describedby={err("starts_on") ? "event-starts-error" : undefined}
          className={field}
        />
        {err("starts_on") && (
          <span id="event-starts-error" className="font-semibold">
            {err("starts_on")}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-2 text-lg">
        Ends on (leave blank for one day)
        <input
          type="date"
          name="ends_on"
          min={today}
          defaultValue={was("ends_on")}
          aria-invalid={!!err("ends_on")}
          aria-describedby={err("ends_on") ? "event-ends-error" : undefined}
          className={field}
        />
        {err("ends_on") && (
          <span id="event-ends-error" className="font-semibold">
            {err("ends_on")}
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
        {pending ? "Saving…" : "Add this event"}
      </button>
    </form>
  );
}
