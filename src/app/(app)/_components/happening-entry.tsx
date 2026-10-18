"use client";

import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { runningIn, startCapture } from "@/lib/happening/local";
import { clockText } from "@/lib/happening/timer";
import { useClock, useKeptCaptures } from "@/lib/happening/hooks";

/**
 * Happening now's way in, on Today and Emergency. One tap starts the timer on
 * this phone, then opens it: no confirmation and no choices. While one runs,
 * on this phone or another in the household, it shows as running instead,
 * and the tap opens it.
 */
export function HappeningEntry({
  dogId,
  timeZone,
  running,
}: {
  dogId: string;
  timeZone: string;
  /** The one Tailhelm has running, and who started it (null for the person signed in). */
  running: { id: string; startedAt: string; by: string | null } | null;
}) {
  const kept = useKeptCaptures();
  const mine = runningIn(kept, dogId);
  // Theirs, unless this phone has already stopped it.
  const theirs = running && !kept.some((c) => c.id === running.id) ? running : null;
  const current = mine ? { startedAt: mine.startedAt, by: running?.id === mine.id ? running.by : null } : theirs;
  if (current) return <Running startedAt={current.startedAt} by={current.by} timeZone={timeZone} />;
  return (
    <Link className="hn-entry" href="/happening-now?start=1" onClick={() => startCapture(dogId)}>
      <Icon name="alert" size={28} />
      <span className="lines">
        <span className="l1">Happening now</span>
        <span className="l2">One tap starts a timer and shows your vet&rsquo;s numbers</span>
      </span>
    </Link>
  );
}

/** The running band, with its own clock so only it ticks. */
function Running({ startedAt, by, timeZone }: { startedAt: string; by: string | null; timeZone: string }) {
  const now = useClock();
  const at = toLocal(new Date(startedAt), timeZone).time;
  return (
    <Link className="hn-entry is-running" href="/happening-now">
      <span className="hn-pulse" aria-hidden="true" />
      <span className="lines">
        <span className="l1">
          Happening now
          {now !== null && <span className="tn"> · {clockText(now - Date.parse(startedAt))}</span>}
        </span>
        <span className="l2 tn">{by ? `${by} started it at ${at}` : `Started at ${at}`}. Open the timer.</span>
      </span>
      <Icon name="open" />
    </Link>
  );
}
