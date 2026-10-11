"use client";

import { useActionState, useState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { ErrorText, Field, NotSaved, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { type DerivedDef, type Range, type ResultType, deriveFrom } from "@/lib/results/input";
import { type ResultState, logResult } from "./actions";

/**
 * Add a lab report: each result and the range printed beside it (filled in
 * from the last report), the derived value shown as they type, then Save.
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
  useCloseOnSave(state.savedAt);
  // The key starts a fresh form after each save, so the next report begins empty.
  return <Fields key={state.savedAt ?? 0} {...{ conditionId, type, derived, today, lastRanges, state, action, pending }} />;
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
  const close = useCloseSheet();
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
  const small = (name: string, label: string, fallback: string, width: number) => (
    <label className="stack-4">
      <span className="ty-sm c2">{label}</span>
      <input
        name={name}
        defaultValue={was(name, fallback)}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="inp tn"
        style={{ width }}
      />
    </label>
  );

  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <input type="hidden" name="type_key" value={type.key} />
      <DateParts name="taken_on" legend="Day the blood was taken" error={err("taken_on")} defaultValue={was("taken_on", today)} />

      {type.fields.map((f) => {
        const last = lastRanges[f.key];
        const error = err(f.key) ?? err(`${f.key}_range`);
        return (
          <fieldset key={f.key} className="field" aria-describedby={error ? `${f.key}-error` : undefined}>
            <legend className="lbl">
              {f.label}{" "}
              <span className="c2" style={{ fontWeight: 400 }}>
                {f.unit}
              </span>
            </legend>
            {error && <ErrorText id={`${f.key}-error`}>{error}</ErrorText>}
            <div className="row gap-12" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="stack-4">
                <span className="ty-sm c2">Result</span>
                <input
                  name={f.key}
                  defaultValue={was(f.key)}
                  onChange={(e) => setTypedValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={err(f.key) ? true : undefined}
                  className="inp tn"
                  style={{ width: 120 }}
                />
              </label>
              {small(`${f.key}_low`, "Report range from", last ? String(last.low) : "", 112)}
              {small(`${f.key}_high`, "to", last ? String(last.high) : "", 112)}
            </div>
          </fieldset>
        );
      })}

      {live.length > 0 && (
        <p aria-live="polite" className="ty-lead tn">
          {live.map((d) => (
            <span key={d.key}>
              <b className="w6">{d.name}</b> {d.value.toFixed(1)}
            </span>
          ))}
        </p>
      )}

      <Field id="result-note" label="Note" optional error={err("note")}>
        <textarea
          id="result-note"
          name="note"
          defaultValue={was("note")}
          rows={2}
          maxLength={500}
          aria-invalid={err("note") ? true : undefined}
          aria-describedby={describedBy("result-note", { error: err("note") })}
          className="inp"
        />
      </Field>

      {state.failed && <NotSaved what="The lab report" />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save lab report"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
