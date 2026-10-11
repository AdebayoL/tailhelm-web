"use client";

import { useActionState } from "react";
import { type ResultState, logWeight } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/** Log a weight: what the scales said and the day. */
export function WeightForm({ conditionId, today }: { conditionId: string; today: string }) {
  const [state, action, pending] = useActionState<ResultState, FormData>(logWeight, {});
  const was = (name: string) => state.values?.[name] ?? "";
  const err = (name: string) => state.errors?.[name];
  return (
    // The key starts a fresh form after each save.
    <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <label className="flex flex-col gap-2 text-lg">
        Weight in kg
        <input
          name="kg"
          inputMode="decimal"
          defaultValue={was("kg")}
          aria-invalid={!!err("kg")}
          aria-describedby={err("kg") ? "weight-kg-error" : undefined}
          className={field}
        />
        {err("kg") && (
          <span id="weight-kg-error" className="font-semibold">
            {err("kg")}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-2 text-lg">
        Date weighed
        <input
          type="date"
          name="taken_on"
          max={today}
          defaultValue={was("taken_on") || today}
          aria-invalid={!!err("taken_on")}
          aria-describedby={err("taken_on") ? "weight-date-error" : undefined}
          className={field}
        />
        {err("taken_on") && (
          <span id="weight-date-error" className="font-semibold">
            {err("taken_on")}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-2 text-lg">
        Note (optional)
        <input
          name="note"
          maxLength={200}
          placeholder="Weighed at the vet's"
          defaultValue={was("note")}
          aria-invalid={!!err("note")}
          className={field}
        />
        {err("note") && <span className="font-semibold">{err("note")}</span>}
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
        {pending ? "Saving…" : "Save weight"}
      </button>
    </form>
  );
}
