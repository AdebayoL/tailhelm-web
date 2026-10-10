"use client";

import { type ReactNode, useActionState, useState } from "react";
import { DOSE_UNITS } from "@/lib/plan/input";
import { type InjectionState, logInjection } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary =
  "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";
const link =
  "min-h-12 self-start text-lg text-green underline underline-offset-4";

export type VialOption = { id: string; label: string };

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

/**
 * Records an injection in three taps: open, check, save. The date starts as
 * today and the amount as the vet's plan, both as the owner can see and change.
 */
export function InjectionLog({
  planItemId,
  product,
  today,
  amount,
  unit,
  vials,
}: {
  planItemId: string;
  product: string;
  today: string;
  amount: number | null;
  unit: string | null;
  vials: VialOption[];
}) {
  const [state, action, pending] = useActionState<InjectionState, FormData>(
    logInjection,
    {},
  );
  // Open until a save that happened after it was opened, so it closes itself once logged.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const open = openedAt !== null && !(state.savedAt && state.savedAt > openedAt);
  const was = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [byWho, setByWho] = useState(was("given_by_who", "me"));
  const [vial, setVial] = useState(was("vial", vials[0]?.id ?? ""));
  const err = (name: string) => state.errors?.[name];
  const described = (name: string, hint = false) =>
    [hint && `${name}-hint`, err(name) && `${name}-error`]
      .filter(Boolean)
      .join(" ") || undefined;

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {state.savedAt && !state.errors && (
          <p aria-live="polite" className="text-lg">
            Injection logged.
          </p>
        )}
        <button type="button" onClick={() => setOpenedAt(Date.now())} className={link}>
          Log a {product} injection
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-2xl border border-ink/30 p-4"
      noValidate
    >
      <input type="hidden" name="plan_item_id" value={planItemId} />
      <Field name="given_on" label="Date given" error={err("given_on")}>
        <input
          id="given_on"
          name="given_on"
          type="date"
          max={today}
          defaultValue={was("given_on", today)}
          aria-describedby={described("given_on")}
          className={field}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field name="amount" label="Amount given" error={err("amount")}>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            defaultValue={was("amount", amount === null ? "" : String(amount))}
            aria-describedby={described("amount")}
            className={field}
          />
        </Field>
        <Field name="unit" label="Unit" error={err("unit")}>
          <select
            id="unit"
            name="unit"
            defaultValue={was("unit", unit ?? "")}
            aria-describedby={described("unit")}
            className={field}
          >
            <option value="">Choose…</option>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {amount !== null && (
        <p className="-mt-3 text-base">
          Filled in from your vet&rsquo;s plan. Change it if a different amount
          was given.
        </p>
      )}

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={described("given_by")}
      >
        <legend className="mb-2 text-lg font-semibold">Who gave it</legend>
        {[
          ["me", "Me"],
          ["someone_else", "Someone else, such as the vet practice"],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-12 items-center gap-3">
            <input
              type="radio"
              name="given_by_who"
              value={value}
              checked={byWho === value}
              onChange={() => setByWho(value)}
              className="size-5 accent-green"
            />
            <span className="text-lg">{label}</span>
          </label>
        ))}
        {byWho === "someone_else" && (
          <input
            name="given_by"
            type="text"
            aria-label="Who gave it"
            defaultValue={was("given_by")}
            className={field}
          />
        )}
        {err("given_by") && (
          <p id="given_by-error" className="font-semibold">
            {err("given_by")}
          </p>
        )}
      </fieldset>

      <Field
        name="site"
        label="Where it was given (optional)"
        hint="For example, left shoulder."
        error={err("site")}
      >
        <input
          id="site"
          name="site"
          type="text"
          defaultValue={was("site")}
          aria-describedby={described("site", true)}
          className={field}
        />
      </Field>

      <Field name="vial" label="Vial (optional)" error={err("vial")}>
        <select
          id="vial"
          name="vial"
          value={vial}
          onChange={(e) => setVial(e.target.value)}
          className={field}
        >
          <option value="">Not recorded</option>
          {vials.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
          <option value="new">A new vial</option>
        </select>
      </Field>
      {vial === "new" && (
        <div className="flex flex-col gap-4 border-l-4 border-sand pl-4">
          <Field
            name="vial_batch"
            label="Batch number (optional)"
            error={err("vial_batch")}
          >
            <input
              id="vial_batch"
              name="vial_batch"
              type="text"
              defaultValue={was("vial_batch")}
              className={field}
            />
          </Field>
          <Field
            name="vial_expires_on"
            label="Expiry date on the vial (optional)"
            error={err("vial_expires_on")}
          >
            <input
              id="vial_expires_on"
              name="vial_expires_on"
              type="date"
              defaultValue={was("vial_expires_on")}
              className={field}
            />
          </Field>
          <Field
            name="vial_opened_on"
            label="Date opened (optional)"
            error={err("vial_opened_on")}
          >
            <input
              id="vial_opened_on"
              name="vial_opened_on"
              type="date"
              max={today}
              defaultValue={was("vial_opened_on", today)}
              className={field}
            />
          </Field>
        </div>
      )}

      <Field name="note" label="Note (optional)" error={err("note")}>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={was("note")}
          className={field}
        />
      </Field>

      {state.failed && (
        <p role="alert" className="font-semibold">
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save injection"}
      </button>
      <button type="button" onClick={() => setOpenedAt(null)} className={link}>
        Cancel
      </button>
    </form>
  );
}
