"use client";

import { useActionState } from "react";
import type { Dog } from "@/lib/dogs/queries";
import { type DogProfileState, saveDogProfile } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

type FieldName = "name" | "vet_name" | "vet_phone" | "out_of_hours_phone" | "vet_email";

const FIELDS: { name: FieldName; label: string; hint?: string; type: string; autoComplete?: string }[] = [
  { name: "name", label: "Your dog's name", type: "text", autoComplete: "off" },
  { name: "vet_name", label: "Vet practice", type: "text", autoComplete: "organization" },
  { name: "vet_phone", label: "Vet's phone number", hint: "Shown as a call button on the emergency screen.", type: "tel", autoComplete: "tel" },
  { name: "out_of_hours_phone", label: "Out-of-hours phone number", hint: "The number your vet gives for nights and weekends.", type: "tel", autoComplete: "tel" },
  { name: "vet_email", label: "Vet's email address", type: "email", autoComplete: "email" },
];

export function DogProfileForm({ dog }: { dog: Dog | null }) {
  const [state, action, pending] = useActionState<DogProfileState, FormData>(saveDogProfile, {});

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {dog && <input type="hidden" name="dog_id" value={dog.id} />}
      {FIELDS.map((f) => {
        const error = state.errors?.[f.name];
        const describedBy = [f.hint && `${f.name}-hint`, error && `${f.name}-error`].filter(Boolean).join(" ");
        return (
          <div key={f.name} className="flex flex-col gap-2">
            <label htmlFor={f.name} className="text-lg font-semibold">
              {f.label}
              {f.name !== "name" && <span className="font-normal"> (optional)</span>}
            </label>
            {f.hint && (
              <p id={`${f.name}-hint`} className="text-base">
                {f.hint}
              </p>
            )}
            <input
              id={f.name}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              required={f.name === "name"}
              defaultValue={dog?.[f.name] ?? ""}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy || undefined}
              className={field}
            />
            {error && (
              <p id={`${f.name}-error`} className="font-semibold">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {state.failed && (
        <p role="alert" className="font-semibold">
          Your changes weren&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.errors && !state.failed ? "Saved." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : dog ? "Save changes" : "Add my dog"}
      </button>
    </form>
  );
}
