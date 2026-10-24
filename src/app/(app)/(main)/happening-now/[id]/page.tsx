import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toLocal } from "@/engine/time";
import { weekdayDate, weekdayDayMonth } from "@/lib/app/dates";
import { joinNames } from "@/lib/app/words";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { getCapture } from "@/lib/happening/queries";
import { FINISH_LATER_HOURS, durationText, lastedText } from "@/lib/happening/timer";
import { formatDate } from "@/lib/plan/input";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { Page } from "../../../_components/page";
import { DetailForm, RemoveRecord } from "./detail-form";

export const metadata: Metadata = { title: "Add detail · Happening now · Tailhelm" };

/**
 * After Happening now stops: what the owner noticed, for the vet. Every field
 * can be left empty, and "Later" leaves it on Today for 48 hours.
 */
export default function CaptureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, owner, dog] = await Promise.all([params, requireOwner(), getMyDog()]);
  const capture = await getCapture(id);
  if (!capture || !dog || capture.dog_id !== dog.id) {
    return (
      <Page title="Add detail" space={24}>
        <div className="panel stack-12 hn-edge" role="status">
          <p className="ty-section">This record isn&rsquo;t here any more. The person who started it may have removed it.</p>
        </div>
        <Link className="btn btn-secondary" href="/today">
          Back to Today
        </Link>
      </Page>
    );
  }
  if (!capture.ended_at) {
    return (
      <Page title="Add detail" space={24}>
        <div className="panel stack-12 hn-edge" role="status">
          <p className="ty-section">This timer is still running.</p>
          <p className="ty-lead c2">Detail can be added once it has stopped.</p>
        </div>
        <Link className="btn btn-primary" href="/happening-now">
          Open the timer
        </Link>
      </Page>
    );
  }
  const [timeZone, names] = await Promise.all([getTimeZone(owner.userId), householdNames(dog.id)]);
  const mine = capture.recorded_by === owner.userId;
  const starterName = (capture.recorded_by && names[capture.recorded_by]) ?? "someone in the household";
  const start = toLocal(new Date(capture.started_at), timeZone);
  const end = toLocal(new Date(capture.ended_at), timeZone);
  const until = toLocal(new Date(Date.parse(capture.ended_at) + FINISH_LATER_HOURS * 3600000), timeZone);
  const seconds = capture.duration_s ?? (Date.parse(capture.ended_at) - Date.parse(capture.started_at)) / 1000;
  const everyone = Object.values(names).sort();
  return (
    <Page
      title="Add detail"
      sub={
        <span className="d-only">
          Happening now for {dog.name} · {weekdayDate(start.date)}
        </span>
      }
      space={24}
    >
      <div className="d-row" style={{ alignItems: "flex-start" }}>
        <section className="card lg stack-24 f-7 hn-detail" aria-label="Add detail">
          <div className="stack-8">
            <p className="ty-lead tn hn-lasted">{lastedText(capture.started_at, capture.ended_at, timeZone, formatDate)}</p>
            <p className="c2">
              Happening now for {dog.name}, started by {mine ? "you" : starterName}.
            </p>
          </div>
          <DetailForm id={capture.id} note={capture.note ?? ""} />
          {mine && (
            <RemoveRecord
              id={capture.id}
              when={`Happening now, ${weekdayDayMonth(start.date)}, ${start.time} to ${end.time}.`}
              who={everyone.length > 1 ? `${joinNames(everyone)} will no longer see it, and it can’t be brought back.` : "It can’t be brought back."}
            />
          )}
        </section>
        <section className="panel stack-12 f-4 d-only hn-record" aria-labelledby="hn-record-t">
          <h2 className="ty-title" id="hn-record-t">
            The record
          </h2>
          <dl className="dl tn">
            <dt>Started</dt>
            <dd>
              {start.time} by {mine ? "you" : starterName}
            </dd>
            <dt>Stopped</dt>
            <dd>{end.date === start.date ? end.time : `${end.time} on ${formatDate(end.date)}`}</dd>
            <dt>Lasted</dt>
            <dd>{durationText(seconds)}</dd>
            <dt>Saved</dt>
            <dd>For everyone who looks after {dog.name}</dd>
            {!capture.detail_complete && (
              <>
                <dt>Open until</dt>
                <dd>
                  {weekdayDayMonth(until.date)} at {until.time}
                </dd>
              </>
            )}
          </dl>
        </section>
      </div>
    </Page>
  );
}
