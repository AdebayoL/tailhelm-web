"use client";

import { useActionState, useRef, useState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { ErrorText, Field, NotSaved, RadioGroup, describedBy } from "@/app/_components/form";
import { Icon } from "@/app/_components/icon";
import { DOSE_UNITS, EMERGENCY_PLAN_KEY, type PlanOption } from "@/lib/plan/input";
import { addPlanItem, type PlanFormState } from "./plan-actions";

export type ActiveItem = { id: string; pack_key: string; label: string };

const MAX_TIMES = 4;

/**
 * Add a medicine, test or stress plan exactly as the vet set it. The pack
 * names what can be added; every number is the owner's, from their vet.
 */
export function PlanItemForm({ conditionId, options, activeItems }: { conditionId: string; options: PlanOption[]; activeItems: ActiveItem[] }) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(addPlanItem, {});
  // The key starts a fresh form after each save.
  return <Fields key={state.savedAt ?? 0} {...{ conditionId, options, activeItems, state, action, pending }} />;
}

function Fields({
  conditionId,
  options,
  activeItems,
  state,
  action,
  pending,
}: {
  conditionId: string;
  options: PlanOption[];
  activeItems: ActiveItem[];
  state: PlanFormState;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [medicineKey, setMedicineKey] = useState(state.values?.pack_key ?? "");
  const [times, setTimes] = useState(Math.max(1, state.times?.filter(Boolean).length ?? 1));
  const medicine = options.find((m) => m.key === medicineKey);
  const isTest = medicine?.kind === "observation";
  const isPlan = medicine?.kind === "task";
  // The vet's written emergency plan: their words first, then the date, as Emergency and Happening now show it.
  const isEmergencyPlan = medicine?.key === EMERGENCY_PLAN_KEY;
  const replaceable = activeItems.filter((i) => i.pack_key === medicineKey);
  const err = (name: string) => state.errors?.[name];
  const was = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const text = (name: string, label: string, opts: { hint?: string; optional?: boolean; numeric?: boolean; width?: number; fallback?: string } = {}) => (
    <Field id={`plan-${name}`} label={label} optional={opts.optional} hint={opts.hint} error={err(name)}>
      <input
        id={`plan-${name}`}
        name={name}
        defaultValue={was(name, opts.fallback)}
        type="text"
        inputMode={opts.numeric ? "decimal" : undefined}
        autoComplete="off"
        aria-invalid={err(name) ? true : undefined}
        aria-describedby={describedBy(`plan-${name}`, { hint: opts.hint, error: err(name) })}
        className={opts.numeric ? "inp tn" : "inp"}
        style={opts.width ? { maxWidth: opts.width } : undefined}
      />
    </Field>
  );
  const time = (name: string, label: string, fallback = "") => (
    <Field id={`plan-${name}`} label={label} error={err(name)}>
      <input
        id={`plan-${name}`}
        name={name}
        type="time"
        defaultValue={was(name, fallback)}
        aria-invalid={err(name) ? true : undefined}
        aria-describedby={describedBy(`plan-${name}`, { error: err(name) })}
        className="inp tn"
        style={{ maxWidth: 160 }}
      />
    </Field>
  );

  const words = (
    <Field
      id="plan-vet_instructions"
      label={isEmergencyPlan ? "Your vet's words" : isPlan ? "Your vet's plan, in their words" : "Your vet's instructions"}
      optional={!isPlan}
      hint={
        isEmergencyPlan
          ? "Type it exactly as your vet wrote it. It's shown on Emergency and Happening now, in their words, with the date they set it."
          : "Copy them as your vet wrote them."
      }
      error={err("vet_instructions")}
    >
      <textarea
        id="plan-vet_instructions"
        name="vet_instructions"
        defaultValue={was("vet_instructions")}
        rows={isPlan ? 5 : 3}
        maxLength={isPlan ? 1000 : 500}
        aria-invalid={err("vet_instructions") ? true : undefined}
        aria-describedby={describedBy("plan-vet_instructions", { hint: true, error: err("vet_instructions") })}
        className="inp"
      />
    </Field>
  );

  return (
    <form ref={form} action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <RadioGroup
        name="pack_key"
        legend="What to add"
        options={options.map((m) => ({ value: m.key, label: m.name }))}
        value={medicineKey}
        onChange={setMedicineKey}
        error={err("pack_key")}
      />

      {medicine?.hint && (
        <p className="hint">{medicine.kind === "observation" ? `The published guidance says: ${medicine.hint}.` : medicine.hint}</p>
      )}

      {medicine && (
        <>
          {medicine.kind === "medicine" && (
            <>
              {text("product", "Medicine name", { hint: "As on the label, for example Prednisolone or Zycortal." })}
              {text("strength", "Strength on the label", { optional: true, hint: "For example 5 mg tablets." })}
              <div className="row gap-12" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 140px" }}>{text("dose_amount", "Amount your vet set", { numeric: true })}</div>
                <div style={{ flex: "1 1 140px" }}>
                  <Field id="plan-dose_unit" label="Unit" error={err("dose_unit")}>
                    <select
                      id="plan-dose_unit"
                      name="dose_unit"
                      defaultValue={was("dose_unit")}
                      aria-invalid={err("dose_unit") ? true : undefined}
                      aria-describedby={describedBy("plan-dose_unit", { error: err("dose_unit") })}
                      className="inp"
                    >
                      <option value="">Choose</option>
                      {DOSE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </>
          )}

          {medicine.scheduleKind === "fixed" && (
            <fieldset className="field" aria-describedby={err("times") ? "plan-times-error" : undefined}>
              <legend className="lbl">Reminder times</legend>
              <p className="hint">The times each day your vet set.</p>
              {err("times") && <ErrorText id="plan-times-error">{err("times")}</ErrorText>}
              <div className="row gap-12" style={{ flexWrap: "wrap" }}>
                {Array.from({ length: times }, (_, i) => (
                  <input
                    key={i}
                    name="times"
                    type="time"
                    defaultValue={state.times?.filter(Boolean)[i] ?? ""}
                    aria-label={`Reminder time ${i + 1}`}
                    className="inp tn"
                    style={{ width: 132 }}
                  />
                ))}
                {times < MAX_TIMES && (
                  <button type="button" className="lnk" onClick={() => setTimes((n) => n + 1)}>
                    <Icon name="add" size={20} />
                    Add another time
                  </button>
                )}
              </div>
            </fieldset>
          )}

          {medicine.scheduleKind === "interval" && (
            <div className="row gap-12" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px" }}>{text("every_days", "Days between injections", { numeric: true })}</div>
              <div style={{ flex: "1 1 160px" }}>{time("time", "Reminder time")}</div>
            </div>
          )}

          {medicine.scheduleKind === "offset" && (
            <div className="row gap-12" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>{text("offsets_days", "Days after each injection", { hint: "For example 10, 25" })}</div>
              <div style={{ flex: "1 1 160px" }}>{time("time", "Reminder time", "09:00")}</div>
            </div>
          )}

          {isEmergencyPlan && words}

          <DateParts
            name="set_by_vet_on"
            legend={
              isTest
                ? "Date your vet asked for these"
                : isEmergencyPlan
                  ? "Date your vet set it"
                  : isPlan
                    ? "Date your vet gave you this plan"
                    : "Date your vet set this dose"
            }
            error={err("set_by_vet_on")}
            defaultValue={was("set_by_vet_on")}
          />

          {!isEmergencyPlan && words}

          {replaceable.length > 0 && (
            <RadioGroup
              name="supersedes_id"
              legend="Does this replace what is on the plan?"
              options={[
                ...replaceable.map((i) => ({ value: i.id, label: `Yes, it replaces ${i.label}` })),
                { value: "", label: "No, it is in addition" },
              ]}
              defaultValue={was("supersedes_id", replaceable[0].id)}
              error={err("supersedes_id")}
            />
          )}
        </>
      )}

      {state.failed && <NotSaved />}
      <div className="row gap-16" style={{ flexWrap: "wrap", paddingTop: 8 }}>
        <button
          type="submit"
          disabled={pending || !medicine}
          className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}
          style={{ width: "auto", flex: "1 1 auto" }}
        >
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Add to care plan"}
        </button>
        {medicine && (
          <button
            type="button"
            className="lnk"
            onClick={() => {
              form.current?.reset();
              setMedicineKey("");
              setTimes(1);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
