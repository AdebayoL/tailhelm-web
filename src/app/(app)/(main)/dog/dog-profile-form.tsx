"use client";

import { useActionState } from "react";
import { ErrorText, Field, NotSaved, describedBy } from "@/app/_components/form";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import type { Dog } from "@/lib/dogs/queries";
import { type DogFormState, saveDogProfile } from "./actions";

/** The dog's name, breed and the month and year they were born. Adds the dog on the first save. */
export function DogProfileForm({ dog }: { dog: Pick<Dog, "id" | "name" | "breed" | "date_of_birth"> | null }) {
  const [state, action, pending] = useActionState<DogFormState, FormData>(saveDogProfile, {});
  useCloseOnSave(state.savedAt);
  const close = useCloseSheet();
  const err = (name: string) => state.errors?.[name];
  const was = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const [bornYear = "", bornMonth = ""] = dog?.date_of_birth?.split("-") ?? [];
  const bornError = err("born");
  const box = (name: string, label: string, fallback: string, width: number, max: number) => (
    <div className="part">
      <span aria-hidden="true">{label}</span>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        maxLength={max}
        aria-label={label}
        defaultValue={was(name, fallback)}
        aria-invalid={bornError ? true : undefined}
        aria-describedby={bornError ? "born-hint born-error" : "born-hint"}
        className={bornError ? "inp is-invalid" : "inp"}
        style={{ width }}
      />
    </div>
  );

  return (
    <form action={action} className="stack-24" noValidate>
      {dog && <input type="hidden" name="dog_id" value={dog.id} />}
      <Field id="dog-name" label="Your dog's name" error={err("name")}>
        <input
          id="dog-name"
          name="name"
          autoComplete="off"
          maxLength={50}
          defaultValue={was("name", dog?.name ?? "")}
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={describedBy("dog-name", { error: err("name") })}
          className="inp"
        />
      </Field>
      <Field id="dog-breed" label="Breed" optional error={err("breed")}>
        <input
          id="dog-breed"
          name="breed"
          autoComplete="off"
          maxLength={60}
          defaultValue={was("breed", dog?.breed ?? "")}
          aria-invalid={err("breed") ? true : undefined}
          aria-describedby={describedBy("dog-breed", { error: err("breed") })}
          className="inp"
        />
      </Field>
      <fieldset className="field">
        <legend className="lbl">
          Born{" "}
          <span className="c2" style={{ fontWeight: 400 }}>
            (optional)
          </span>
        </legend>
        <p className="hint" id="born-hint">
          The month and year, for example 3 2019
        </p>
        {bornError && <ErrorText id="born-error">{bornError}</ErrorText>}
        <div className="date">
          {box("born_month", "Month", bornMonth ? String(Number(bornMonth)) : "", 64, 2)}
          {box("born_year", "Year", bornYear, 96, 4)}
        </div>
      </fieldset>
      {state.failed && <NotSaved what={dog ? "The profile" : "Your dog"} />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : dog ? "Save changes" : "Add my dog"}
        </button>
        {dog && (
          <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
