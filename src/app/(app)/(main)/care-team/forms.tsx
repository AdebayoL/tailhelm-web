"use client";

import { useActionState, useState } from "react";
import { Field, describedBy } from "@/app/_components/form";
import { Icon } from "@/app/_components/icon";
import { useCloseOnSave, useCloseSheet } from "@/app/_components/sheet-link";
import { INVITATION_DAYS } from "@/lib/household/input";
import { type FormState, inviteMember, leaveHousehold, removeMember, saveDisplayName } from "./actions";

function Submit({ pending, label, busy = "Saving…" }: { pending: boolean; label: string; busy?: string }) {
  return (
    <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
      {pending && <span className="spin" aria-hidden="true" />}
      {pending ? busy : label}
    </button>
  );
}

function Cancel() {
  const close = useCloseSheet();
  return (
    <button type="button" className="lnk" style={{ alignSelf: "center" }} onClick={close}>
      Cancel
    </button>
  );
}

/** The owner invites someone to the household by email. */
export function InviteForm({ dogId, dogName }: { dogId: string; dogName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMember, {});
  useCloseOnSave(state.savedAt);
  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="dog_id" value={dogId} />
      <Field
        id="invite-email"
        label="Their email address"
        hint={`They sign in to Tailhelm with this address to see ${dogName}'s list. The invitation stays open for ${INVITATION_DAYS} days.`}
        error={state.error}
      >
        <input
          id="invite-email"
          type="email"
          name="email"
          autoComplete="off"
          defaultValue={state.value ?? ""}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy("invite-email", { hint: true, error: state.error })}
          className="inp"
        />
      </Field>
      <div className="stack-8">
        <Submit pending={pending} label="Send invitation" busy="Sending…" />
        <Cancel />
      </div>
    </form>
  );
}

/** The name the household sees beside each record. */
export function NameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDisplayName, {});
  useCloseOnSave(state.savedAt);
  return (
    <form action={action} className="stack-24" noValidate>
      <Field id="display-name" label="Your name" hint="Shown beside everything you record, such as “Given 08:04 by Sam”." error={state.error}>
        <input
          id="display-name"
          name="display_name"
          maxLength={40}
          autoComplete="given-name"
          defaultValue={state.value ?? name ?? ""}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy("display-name", { hint: true, error: state.error })}
          className="inp"
        />
      </Field>
      <div className="stack-8">
        <Submit pending={pending} label="Save name" />
        <Cancel />
      </div>
    </form>
  );
}

/** Two taps, so a person is never removed by a slip of the thumb. */
export function RemoveMember({ memberId, name, dogName }: { memberId: string; name: string; dogName: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="btn btn-secondary">
        Remove from the care team
      </button>
    );
  }
  return (
    <form action={removeMember} className="stack-16">
      <input type="hidden" name="member_id" value={memberId} />
      <div className="banner banner-warn" role="alert">
        <Icon name="attention" />
        <p>
          <b>{name} will stop seeing {dogName}&rsquo;s list at once.</b> Remove them?
        </p>
      </div>
      <div className="sheet-actions">
        <button type="button" onClick={() => setAsking(false)} className="btn btn-secondary">
          Keep {name}
        </button>
        <button type="submit" className="btn btn-primary">
          Yes, remove
        </button>
      </div>
    </form>
  );
}

/** A member leaves; the owner cannot, so the dog always has one. */
export function LeaveForm({ dogId, dogName }: { dogId: string; dogName: string }) {
  return (
    <form action={leaveHousehold} className="stack-16">
      <input type="hidden" name="dog_id" value={dogId} />
      <div className="banner banner-warn" role="alert">
        <Icon name="attention" />
        <p>
          <b>You will stop seeing {dogName}&rsquo;s list and reminders at once.</b> The owner can invite you again.
        </p>
      </div>
      <div className="stack-8">
        <button type="submit" className="btn btn-primary">
          Leave the care team
        </button>
        <Cancel />
      </div>
    </form>
  );
}
