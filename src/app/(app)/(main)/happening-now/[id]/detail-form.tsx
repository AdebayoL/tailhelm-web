"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, NotSaved, describedBy } from "@/app/_components/form";
import { Sheet } from "@/app/_components/sheet";
import { type DetailState, removeCapture, saveCaptureDetail } from "@/app/(app)/happening-now/actions";

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
          className="inp hn-note-inp"
        />
      </Field>
      {state.failed && <NotSaved what="The detail" />}
      <div className="stack-12">
        <div className="hn-detail-acts">
          {/* No spinner: nothing in Happening now moves. */}
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
          <Link className="btn btn-secondary" href="/today">
            Later
          </Link>
        </div>
        <p className="prov">Saving with nothing typed still finishes it.</p>
      </div>
    </form>
  );
}

/**
 * "Started by mistake?", for the person who started it. Removing deletes the
 * record for the whole household and can't be undone, so it asks once, with
 * keeping it as the main button. Neither is red: nothing here is an emergency.
 */
export function RemoveRecord({ id, when, who }: { id: string; when: string; who: string }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  return (
    <section className={open ? "panel stack-12 hn-mistake" : "hn-mistake is-shut"} aria-label="Started by mistake">
      <button type="button" className="lnk" aria-expanded={open} aria-controls="hn-mistake-body" onClick={() => setOpen((o) => !o)}>
        Started by mistake?
      </button>
      {open && (
        <div id="hn-mistake-body" className="stack-12">
          <p className="ty-sm" style={{ textWrap: "pretty" }}>
            Removing it deletes this record for everyone in the household.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setAsking(true)}>
            Remove this record
          </button>
        </div>
      )}
      {asking && (
        <Sheet label="Remove this record for everyone?" onClose={() => setAsking(false)} alert>
          <h2 className="ty-page">Remove this record for everyone?</h2>
          <p className="ty-lead tn" style={{ textWrap: "pretty" }}>
            {when} {who}
          </p>
          <form action={removeCapture} className="stack-12">
            <input type="hidden" name="id" value={id} />
            <button type="button" className="btn btn-primary" onClick={() => setAsking(false)}>
              Keep the record
            </button>
            <button type="submit" className="btn btn-secondary">
              Remove for everyone
            </button>
          </form>
        </Sheet>
      )}
    </section>
  );
}
