"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, NotSaved, describedBy } from "@/app/_components/form";
import { type DetailState, saveCaptureDetail } from "../actions";

/** What the owner noticed, in their own words. Saving with it empty still finishes the record. */
export function DetailForm({ id, note }: { id: string; note: string }) {
  const [state, action, pending] = useActionState<DetailState, FormData>(saveCaptureDetail, {});
  const err = state.errors?.note;
  return (
    <form action={action} className="stack-24" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field
        id="hn-note"
        label="What you noticed"
        optional
        hint="For example what happened before it started, what it looked like, and how they were afterwards. Kept with the record for your vet."
        error={err}
      >
        <textarea
          id="hn-note"
          name="note"
          rows={5}
          maxLength={1000}
          defaultValue={state.values?.note ?? note}
          aria-invalid={err ? true : undefined}
          aria-describedby={describedBy("hn-note", { hint: true, error: err })}
          className="inp"
        />
      </Field>
      {state.failed && <NotSaved what="The detail" />}
      <div className="stack-8">
        <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
          {pending && <span className="spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save"}
        </button>
        <Link className="lnk" href="/today" style={{ alignSelf: "center" }}>
          Later
        </Link>
      </div>
    </form>
  );
}
