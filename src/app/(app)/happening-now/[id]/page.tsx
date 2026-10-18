import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { getCapture } from "@/lib/happening/queries";
import { lastedText } from "@/lib/happening/timer";
import { formatDate } from "@/lib/plan/input";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { OwnerOnly } from "../../_components/owner-only";
import { PageStatus } from "../../_components/page";
import { removeCapture } from "../actions";
import { DetailForm } from "./detail-form";

export const metadata: Metadata = { title: "Add detail · Happening now · Tailhelm" };

/**
 * After Happening now stops: what the owner noticed, for the vet. Every field
 * can be left empty, and "Later" leaves it on Today for 48 hours.
 */
export default function CaptureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="em">
      <OwnerOnly />
      <header className="em-hdr">
        <h1 className="em-title">Add detail</h1>
      </header>
      {/* The address holds the record's id, so even the banner's fallback waits for it. */}
      <Suspense fallback={null}>
        <PageStatus />
      </Suspense>
      <main className="em-main">
        <Suspense fallback={null}>
          <Detail params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, owner, dog] = await Promise.all([params, requireOwner(), getMyDog()]);
  const capture = await getCapture(id);
  if (!capture || !dog || capture.dog_id !== dog.id) {
    return (
      <div className="stack-16">
        <p className="ty-lead">This record isn&rsquo;t here any more. The person who started it may have removed it.</p>
        <Link className="btn btn-primary" href="/today">
          Back to Today
        </Link>
      </div>
    );
  }
  if (!capture.ended_at) {
    return (
      <div className="stack-16">
        <p className="ty-lead">This timer is still running.</p>
        <Link className="btn btn-primary" href="/happening-now">
          Open the timer
        </Link>
      </div>
    );
  }
  const [timeZone, names] = await Promise.all([getTimeZone(owner.userId), householdNames(dog.id)]);
  const mine = capture.recorded_by === owner.userId;
  const starter = mine ? "you" : ((capture.recorded_by && names[capture.recorded_by]) ?? "someone in the household");
  return (
    <div className="stack-24" style={{ flex: "1 1 520px" }}>
      <div className="stack-4">
        <p className="ty-lead tn">{lastedText(capture.started_at, capture.ended_at, timeZone, formatDate)}</p>
        <p className="prov">
          Happening now for {dog.name}, started by {starter}.
        </p>
      </div>
      <DetailForm id={capture.id} note={capture.note ?? ""} />
      {mine && (
        <details className="stack-8">
          <summary className="lnk">Started by mistake?</summary>
          <form action={removeCapture} className="stack-8">
            <input type="hidden" name="id" value={capture.id} />
            <p className="hint">Removing it deletes this record for everyone in the household.</p>
            <button type="submit" className="btn btn-secondary">
              Remove this record
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
