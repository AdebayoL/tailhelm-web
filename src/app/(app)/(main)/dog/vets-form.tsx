"use client";

import { useActionState, useState } from "react";
import { ErrorText, Field, NotSaved, describedBy } from "@/app/_components/form";
import { Icon } from "@/app/_components/icon";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { type Hours, WEEKDAYS } from "@/lib/dogs/hours";
import type { Dog } from "@/lib/dogs/queries";
import { type DogFormState, saveDogVets } from "./actions";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Seven rows of opening and closing times, or open around the clock. */
function HoursField({
  prefix,
  legend,
  hours,
  values,
  error,
}: {
  prefix: string;
  legend: string;
  hours: Hours | null;
  values?: Record<string, string>;
  error?: string;
}) {
  const [always, setAlways] = useState(values ? values[`${prefix}_always`] === "on" : !!hours && "always" in hours);
  const span = (day: number) => (hours && "week" in hours ? hours.week[day] : null);
  const was = (name: string, fallback: string) => (values ? (values[name] ?? "") : fallback);
  return (
    <fieldset className="field" aria-describedby={[`${prefix}-hint`, error && `${prefix}-error`].filter(Boolean).join(" ")}>
      <legend className="lbl">
        {legend}{" "}
        <span className="c2" style={{ fontWeight: 400 }}>
          (optional)
        </span>
      </legend>
      <p className="hint" id={`${prefix}-hint`}>
        Leave both times blank on a day it is closed. Emergency uses these to choose who to call first.
      </p>
      {error && <ErrorText id={`${prefix}-error`}>{error}</ErrorText>}
      <label className="check" style={{ borderTop: 0 }}>
        <input className="sr" type="checkbox" name={`${prefix}_always`} checked={always} onChange={(e) => setAlways(e.target.checked)} />
        <span className={always ? "box on" : "box"}>
          <Icon name="tick" />
        </span>
        <span>Open 24 hours, every day</span>
      </label>
      {!always && (
        <div className="hours-grid">
          {WEEKDAYS.map((day, i) => (
            <div key={day} className="hours-row" role="group" aria-label={DAY_NAMES[i]}>
              <span className="w6">{day}</span>
              <input
                type="time"
                name={`${prefix}_${i}_open`}
                aria-label={`${DAY_NAMES[i]}, opens`}
                defaultValue={was(`${prefix}_${i}_open`, span(i)?.[0] ?? "")}
                className="inp tn"
              />
              <span aria-hidden="true" className="c2">
                to
              </span>
              <input
                type="time"
                name={`${prefix}_${i}_close`}
                aria-label={`${DAY_NAMES[i]}, closes`}
                defaultValue={was(`${prefix}_${i}_close`, span(i)?.[1] ?? "")}
                className="inp tn"
              />
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** The dog's own vet and the out-of-hours service, as the emergency screen calls them. */
export function VetsForm({ dog }: { dog: Dog }) {
  const [state, action, pending] = useActionState<DogFormState, FormData>(saveDogVets, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const err = (name: string) => state.errors?.[name];
  const was = (name: string, fallback: string | null) => state.values?.[name] ?? fallback ?? "";
  const input = (name: keyof Dog & string, label: string, type: string, autoComplete: string, hint?: string) => (
    <Field id={`vets-${name}`} label={label} optional hint={hint} error={err(name)}>
      <input
        id={`vets-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={was(name, dog[name] as string | null)}
        aria-invalid={err(name) ? true : undefined}
        aria-describedby={describedBy(`vets-${name}`, { hint, error: err(name) })}
        className="inp"
      />
    </Field>
  );

  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_id" value={dog.id} />
      <h3 className="ty-section">Your vet</h3>
      {input("vet_name", "Practice name", "text", "organization")}
      {input("vet_phone", "Phone number", "tel", "tel", "Shown as a call button on the emergency screen.")}
      {input("vet_email", "Email address", "email", "email")}
      <HoursField prefix="vet_hours" legend="Opening hours" hours={dog.vet_hours} values={state.values} error={err("vet_hours")} />
      <hr className="hr" />
      <h3 className="ty-section">Out of hours</h3>
      {input("out_of_hours_name", "Service name", "text", "off", "The practice your vet uses for nights and weekends.")}
      {input("out_of_hours_phone", "Phone number", "tel", "tel")}
      <HoursField prefix="ooh_hours" legend="Opening hours" hours={dog.out_of_hours_hours} values={state.values} error={err("ooh_hours")} />
      {state.failed && <NotSaved />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
