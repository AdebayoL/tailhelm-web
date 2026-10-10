"use client";

import { useActionState } from "react";
import type { Sign } from "@/lib/signs/signs";
import { type CheckState, logQuickCheck } from "./actions";

const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/** The quick check: tap any sign noticed today, then Save. Saving with none ticked records that too. */
export function QuickCheck({ conditionId, signs }: { conditionId: string; signs: Sign[] }) {
  const [state, action, pending] = useActionState<CheckState, FormData>(logQuickCheck, {});
  return (
    // The key clears the toggles after each save.
    <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg">Tap anything you noticed today, then save.</legend>
        <div className="grid grid-cols-2 gap-2">
          {signs.map((s) => (
            <label
              key={s.key}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-ink/30 px-3 py-2 text-base has-[:checked]:border-2 has-[:checked]:border-green has-[:checked]:font-semibold"
            >
              <input type="checkbox" name="sign" value={s.key} className="size-5 accent-green" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.failed ? "Saved." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save today's check"}
      </button>
    </form>
  );
}
