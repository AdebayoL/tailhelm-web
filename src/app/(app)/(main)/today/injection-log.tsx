"use client";

import { useActionState, useState } from "react";
import { DateParts } from "@/app/_components/date-parts";
import { Field, NotSaved, RadioGroup, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { DOSE_UNITS } from "@/lib/plan/input";
import { type InjectionState, logInjection } from "./actions";

export type VialOption = { id: string; label: string };

/**
 * Records an injection: open, check, save. The date starts as today and the
 * amount as the vet's plan, both as the owner can see and change.
 */
export function InjectionLog({
  planItemId,
  today,
  amount,
  unit,
  vials,
}: {
  planItemId: string;
  today: string;
  amount: number | null;
  unit: string | null;
  vials: VialOption[];
}) {
  const [state, action, pending] = useActionState<InjectionState, FormData>(logInjection, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const was = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [byWho, setByWho] = useState(was("given_by_who", "me"));
  const [vial, setVial] = useState(was("vial", vials[0]?.id ?? ""));
  const err = (name: string) => state.errors?.[name];

  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="plan_item_id" value={planItemId} />
      <DateParts name="given_on" legend="Date given" error={err("given_on")} defaultValue={was("given_on", today)} />

      <div className="stack-8">
        <div className="row gap-12" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 0" }}>
            <Field id="amount" label="Amount given" error={err("amount")}>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                defaultValue={was("amount", amount === null ? "" : String(amount))}
                aria-invalid={err("amount") ? true : undefined}
                aria-describedby={describedBy("amount", { error: err("amount") })}
                className="inp"
              />
            </Field>
          </div>
          <div style={{ flex: "1 1 0" }}>
            <Field id="unit" label="Unit" error={err("unit")}>
              <select
                id="unit"
                name="unit"
                defaultValue={was("unit", unit ?? "")}
                aria-invalid={err("unit") ? true : undefined}
                aria-describedby={describedBy("unit", { error: err("unit") })}
                className="inp"
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
        </div>
        {amount !== null && (
          <p className="hint">Filled in from your vet&rsquo;s plan. Change it if a different amount was given.</p>
        )}
      </div>

      <div className="stack-8">
        <RadioGroup
          name="given_by_who"
          legend="Who gave it"
          value={byWho}
          onChange={setByWho}
          error={err("given_by")}
          options={[
            { value: "me", label: "Me" },
            { value: "someone_else", label: "Someone else, such as the vet practice" },
          ]}
        />
        {byWho === "someone_else" && (
          <input name="given_by" type="text" aria-label="Who gave it" defaultValue={was("given_by")} className="inp" />
        )}
      </div>

      <Field id="site" label="Where it was given" optional hint="For example, left shoulder." error={err("site")}>
        <input
          id="site"
          name="site"
          type="text"
          defaultValue={was("site")}
          aria-describedby={describedBy("site", { hint: true, error: err("site") })}
          className="inp"
        />
      </Field>

      <Field id="vial" label="Vial" optional error={err("vial")}>
        <select id="vial" name="vial" value={vial} onChange={(e) => setVial(e.target.value)} className="inp">
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
        <div className="panel stack-24">
          <Field id="vial_batch" label="Batch number" optional error={err("vial_batch")}>
            <input id="vial_batch" name="vial_batch" type="text" defaultValue={was("vial_batch")} className="inp" />
          </Field>
          <DateParts
            name="vial_expires_on"
            legend="Expiry date on the vial"
            optional
            error={err("vial_expires_on")}
            defaultValue={was("vial_expires_on")}
          />
          <DateParts
            name="vial_opened_on"
            legend="Date opened"
            optional
            error={err("vial_opened_on")}
            defaultValue={was("vial_opened_on", today)}
          />
        </div>
      )}

      <Field id="note" label="Note" optional error={err("note")}>
        <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={was("note")} className="inp" />
      </Field>

      {state.failed && <NotSaved />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save injection"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
