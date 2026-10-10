"use client";

import { useActionState, useState } from "react";
import { type DerivedDef, type Range, type ResultType, deriveFrom } from "@/lib/results/input";
import { type ResultState, logResult } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/**
 * Log a result: the condition's fields, the ranges printed on the owner's lab
 * report (filled in from their last result), the derived value shown as they
 * type, then Save.
 */
export function ResultForm({
  conditionId,
  type,
  derived,
  today,
  lastRanges,
}: {
  conditionId: string;
  type: ResultType;
  derived: DerivedDef[];
  today: string;
  lastRanges: Record<string, Range>;
}) {
  const [state, action, pending] = useActionState<ResultState, FormData>(logResult, {});
  // The key starts a fresh form after each save, so the next result begins empty.
  return (
    <Fields
      key={state.savedAt ?? 0}
      {...{ conditionId, type, derived, today, lastRanges, state, action, pending }}
    />
  );
}

function Fields({
  conditionId,
  type,
  derived,
  today,
  lastRanges,
  state,
  action,
  pending,
}: {
  conditionId: string;
  type: ResultType;
  derived: DerivedDef[];
  today: string;
  lastRanges: Record<string, Range>;
  state: ResultState;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const was = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [typedValues, setTypedValues] = useState<Record<string, string>>({});
  const err = (name: string) => state.errors?.[name];
  const live = deriveFrom(
    derived,
    Object.fromEntries(
      type.fields.flatMap((f) => {
        const n = Number(typedValues[f.key] ?? was(f.key));
        return n > 0 ? [[f.key, n]] : [];
      }),
    ),
  );

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <input type="hidden" name="type_key" value={type.key} />

      <div className="flex flex-col gap-2">
        <label htmlFor="taken_on" className="text-lg font-semibold">
          Date the blood was taken
        </label>
        <input id="taken_on" name="taken_on" type="date" max={today} defaultValue={was("taken_on", today)} aria-describedby={err("taken_on") ? "taken_on-error" : undefined} className={field} />
        {err("taken_on") && (
          <p id="taken_on-error" className="font-semibold">
            {err("taken_on")}
          </p>
        )}
      </div>

      {type.fields.map((f) => (
        <fieldset key={f.key} className="flex flex-col gap-2">
          <legend className="mb-2 text-lg font-semibold">
            {f.label} ({f.unit})
          </legend>
          <input
            name={f.key}
            aria-label={`${f.label} result`}
            defaultValue={was(f.key)}
            onChange={(e) => setTypedValues((v) => ({ ...v, [f.key]: e.target.value }))}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={err(f.key) ? `${f.key}-error` : undefined}
            className={field}
          />
          {err(f.key) && (
            <p id={`${f.key}-error`} className="font-semibold">
              {err(f.key)}
            </p>
          )}
          <p className="text-base">Range printed on the lab report (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              name={`${f.key}_low`}
              aria-label={`${f.label} range, lowest`}
              placeholder="From"
              defaultValue={was(`${f.key}_low`, lastRanges[f.key] ? String(lastRanges[f.key].low) : "")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={field}
            />
            <input
              name={`${f.key}_high`}
              aria-label={`${f.label} range, highest`}
              placeholder="To"
              defaultValue={was(`${f.key}_high`, lastRanges[f.key] ? String(lastRanges[f.key].high) : "")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={field}
            />
          </div>
          {err(`${f.key}_range`) && <p className="font-semibold">{err(`${f.key}_range`)}</p>}
        </fieldset>
      ))}

      {live.length > 0 && (
        <p aria-live="polite" className="text-xl font-semibold">
          {live.map((d) => `${d.name} ${d.value.toFixed(1)}`).join(", ")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="note" className="text-lg font-semibold">
          Note (optional)
        </label>
        <textarea id="note" name="note" defaultValue={was("note")} rows={2} maxLength={500} className={field} />
        {err("note") && <p className="font-semibold">{err("note")}</p>}
      </div>

      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.errors && !state.failed ? "Result saved." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save result"}
      </button>
    </form>
  );
}
