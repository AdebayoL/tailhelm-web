"use client";

import { useActionState } from "react";
import { type FormState, inviteMember, saveDisplayName } from "./actions";

const field =
  "w-full rounded-lg border border-rule-strong bg-card px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary = "min-h-12 w-full rounded-2xl bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";

/** The owner invites someone to the household by email. */
export function InviteForm({ dogId }: { dogId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMember, {});
  return (
    // The key starts a fresh form after each invitation.
    <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <label className="flex flex-col gap-2 text-lg">
        Their email address
        <input
          type="email"
          name="email"
          autoComplete="off"
          defaultValue={state.value ?? ""}
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "invite-error" : undefined}
          className={field}
        />
        {state.error && (
          <span id="invite-error" className="font-semibold">
            {state.error}
          </span>
        )}
      </label>
      <p aria-live="polite" className="text-lg">
        {state.savedAt ? "Invited. Ask them to sign in to Tailhelm with that address to accept." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Inviting…" : "Invite"}
      </button>
    </form>
  );
}

/** The name the household sees beside each tick. */
export function NameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDisplayName, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-2 text-lg">
        Your name, as the household sees it
        <input
          name="display_name"
          maxLength={40}
          defaultValue={state.value ?? name ?? ""}
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "name-error" : undefined}
          className={field}
        />
        {state.error && (
          <span id="name-error" className="font-semibold">
            {state.error}
          </span>
        )}
      </label>
      <p aria-live="polite" className="text-lg">
        {state.savedAt && !state.error ? "Saved." : ""}
      </p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}
