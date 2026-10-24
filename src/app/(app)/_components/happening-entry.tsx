"use client";

import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { type LocalCapture, runningIn, startCapture } from "@/lib/happening/local";
import { clockText } from "@/lib/happening/timer";
import { useClock, useKeptCaptures } from "@/lib/happening/hooks";

/** The one Tailhelm has running, and who started it (null for the person signed in). */
export type Running = { id: string; startedAt: string; by: string | null } | null;

/** What runs for the dog: this phone's own timer first, then the household's, unless this phone has already stopped that. */
function runningNow(kept: LocalCapture[], dogId: string, running: Running): { startedAt: string; by: string | null } | null {
  const mine = runningIn(kept, dogId);
  if (mine) return { startedAt: mine.startedAt, by: running?.id === mine.id ? running.by : null };
  return running && !kept.some((c) => c.id === running.id) ? running : null;
}

/**
 * Happening now's way in, on Today and Emergency. One tap starts the timer on
 * this phone, then opens it: no confirmation and no choices. While one runs,
 * on this phone or another in the household, the tap opens that one.
 */
export function HappeningEntry({ dogId, running, className = "" }: { dogId: string; running: Running; className?: string }) {
  const kept = useKeptCaptures();
  const current = runningNow(kept, dogId, running);
  return (
    <Link
      className={`hn-entry ${className}`.trim()}
      href={current ? "/happening-now" : "/happening-now?start=1"}
      onClick={current ? undefined : () => startCapture(dogId)}
    >
      <span className="disc" aria-hidden="true">
        <Icon name="stopwatch" />
      </span>
      <span>
        <span className="e1">Happening now</span>
        <span className="e2">One tap starts a timer and shows your vet&rsquo;s numbers</span>
      </span>
      <Icon name="open" className="chev" />
    </Link>
  );
}

/**
 * The running band under the header on Today and Emergency, while a timer runs
 * on this phone or another in the household. Nobody is notified when one
 * starts; this is what the household sees when they open Tailhelm.
 */
export function HappeningBand({ dogId, timeZone, running }: { dogId: string; timeZone: string; running: Running }) {
  const kept = useKeptCaptures();
  const current = runningNow(kept, dogId, running);
  return current ? <Band startedAt={current.startedAt} by={current.by} timeZone={timeZone} /> : null;
}

/** The band itself, with its own clock so only it ticks. Perfectly still apart from the digits. */
function Band({ startedAt, by, timeZone }: { startedAt: string; by: string | null; timeZone: string }) {
  const now = useClock();
  const at = toLocal(new Date(startedAt), timeZone).time;
  const clock = now === null ? null : clockText(now - Date.parse(startedAt));
  const who = by ? `${by} started it at ${at}` : `Started at ${at}`;
  return (
    <Link className="hn-band" href="/happening-now" aria-label={`Happening now${clock ? `, ${clock}` : ""}. ${who}. Open the timer.`}>
      <span className="disc" aria-hidden="true">
        <Icon name="stopwatch" />
      </span>
      <span aria-hidden="true">
        <span className="t1">
          Happening now{clock && <span className="tn"> · {clock}</span>}
        </span>
        <span className="t2">
          {who}. <u>Open the timer.</u>
        </span>
      </span>
      <Icon name="open" className="chev" />
    </Link>
  );
}
