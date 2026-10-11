"use client";

import { type ReactNode, useActionState, useState } from "react";
import { DOSE_UNITS, type PlanOption } from "@/lib/plan/input";
import { addPlanItem, type PlanFormState } from "./plan-actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

export type ActiveItem = { id: string; pack_key: string; label: string };

const TIME_SLOTS = 4;

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-lg font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="text-base">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${name}-error`} className="font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

export function PlanItemForm({
  conditionId,
  options,
  activeItems,
}: {
  conditionId: string;
  options: PlanOption[];
  activeItems: ActiveItem[];
}) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(addPlanItem, {});
  const [medicineKey, setMedicineKey] = useState(state.values?.pack_key ?? "");
  const medicine = options.find((m) => m.key === medicineKey);
  const isTest = medicine?.kind === "observation";
  const isPlan = medicine?.kind === "task";
  const replaceable = activeItems.filter((i) => i.pack_key === medicineKey);
  const err = (name: string) => state.errors?.[name];
  const was = (name: string) => state.values?.[name] ?? "";

  const described = (name: string, hint = false) =>
    [hint && `${name}-hint`, err(name) && `${name}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="dog_condition_id" value={conditionId} />
      <Field name="pack_key" error={err("pack_key")} label="What to add">
        <select
          id="pack_key"
          name="pack_key"
          value={medicineKey}
          onChange={(e) => setMedicineKey(e.target.value)}
          aria-invalid={err("pack_key") ? true : undefined}
          aria-describedby={described("pack_key")}
          className={field}
        >
          <option value="">Choose…</option>
          {options.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      {medicine?.hint && (
        <p className="text-base">{medicine.kind === "observation" ? `The published guidance says: ${medicine.hint}.` : medicine.hint}</p>
      )}

      {medicine && (
        <>
          {medicine.kind === "medicine" && (
            <>
              <Field name="product" error={err("product")} label="Name on the label" hint="For example Prednisolone or Zycortal.">
                <input id="product" name="product" defaultValue={was("product")} type="text" autoComplete="off" aria-describedby={described("product", true)} className={field} />
              </Field>
              <Field name="strength" error={err("strength")} label="Strength on the label (optional)" hint="For example 5 mg tablets.">
                <input id="strength" name="strength" defaultValue={was("strength")} type="text" autoComplete="off" aria-describedby={described("strength", true)} className={field} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field name="dose_amount" error={err("dose_amount")} label="Amount your vet set">
                  <input
                    id="dose_amount"
                    name="dose_amount"
                    defaultValue={was("dose_amount")}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-invalid={err("dose_amount") ? true : undefined}
                    aria-describedby={described("dose_amount")}
                    className={field}
                  />
                </Field>
                <Field name="dose_unit" error={err("dose_unit")} label="Unit">
                  <select id="dose_unit" name="dose_unit" defaultValue={was("dose_unit")} aria-describedby={described("dose_unit")} className={field}>
                    <option value="">Choose…</option>
                    {DOSE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {medicine.scheduleKind === "fixed" && (
            <fieldset className="flex flex-col gap-2" aria-describedby={described("times")}>
              <legend className="mb-2 text-lg font-semibold">Times each day your vet set</legend>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: TIME_SLOTS }, (_, i) => (
                  <input key={i} name="times" type="time" defaultValue={state.times?.[i] ?? ""} aria-label={`Time ${i + 1}`} className={field} />
                ))}
              </div>
              <p className="text-base">Fill in as many as your vet set.</p>
              {err("times") && (
                <p id="times-error" className="font-semibold">
                  {err("times")}
                </p>
              )}
            </fieldset>
          )}

          {medicine.scheduleKind === "interval" && (
            <div className="grid grid-cols-2 gap-3">
              <Field name="every_days" error={err("every_days")} label="Days between injections">
                <input id="every_days" name="every_days" defaultValue={was("every_days")} type="text" inputMode="numeric" aria-describedby={described("every_days")} className={field} />
              </Field>
              <Field name="time" error={err("time")} label="Reminder time">
                <input id="time" name="time" defaultValue={was("time")} type="time" aria-describedby={described("time")} className={field} />
              </Field>
            </div>
          )}

          {medicine.scheduleKind === "offset" && (
            <div className="grid grid-cols-2 gap-3">
              <Field name="offsets_days" error={err("offsets_days")} label="Days after each injection">
                <input id="offsets_days" name="offsets_days" defaultValue={was("offsets_days")} type="text" inputMode="numeric" autoComplete="off" placeholder="For example 10, 25" aria-describedby={described("offsets_days")} className={field} />
              </Field>
              <Field name="time" error={err("time")} label="Reminder time">
                <input id="time" name="time" defaultValue={was("time") || "09:00"} type="time" aria-describedby={described("time")} className={field} />
              </Field>
            </div>
          )}

          <Field name="set_by_vet_on" error={err("set_by_vet_on")} label={isTest ? "Date your vet asked for these" : isPlan ? "Date your vet gave you this plan" : "Date your vet set this"}>
            <input id="set_by_vet_on" name="set_by_vet_on" defaultValue={was("set_by_vet_on")} type="date" aria-describedby={described("set_by_vet_on")} className={field} />
          </Field>
          <Field
            name="vet_instructions"
            error={err("vet_instructions")}
            label={isPlan ? "Your vet's plan, in their words" : "Your vet's instructions (optional)"}
            hint="Copy them as your vet wrote them."
          >
            <textarea
              id="vet_instructions"
              name="vet_instructions"
              defaultValue={was("vet_instructions")}
              rows={isPlan ? 5 : 3}
              maxLength={isPlan ? 1000 : 500}
              aria-describedby={described("vet_instructions", true)}
              className={field}
            />
          </Field>

          {replaceable.length > 0 && (
            <Field name="supersedes_id" error={err("supersedes_id")} label="Does this replace what's on the plan?">
              <select id="supersedes_id" name="supersedes_id" defaultValue={replaceable[0].id} className={field}>
                {replaceable.map((i) => (
                  <option key={i.id} value={i.id}>
                    Yes, it replaces {i.label}
                  </option>
                ))}
                <option value="">No, it&rsquo;s in addition</option>
              </select>
            </Field>
          )}
        </>
      )}

      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.errors && !state.failed ? "Added to the plan." : ""}
      </p>
      <button type="submit" disabled={pending || !medicine} className={primary}>
        {pending ? "Saving…" : "Add to the plan"}
      </button>
    </form>
  );
}
