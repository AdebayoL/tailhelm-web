"use client";

import type { CSSProperties } from "react";
import { toLocal } from "@/engine/time";
import { untilText } from "@/lib/app/words";
import { LATE_AFTER_MS } from "@/lib/today/today";
import { dayPercent } from "@/lib/today/view";
import type { DoseView } from "./dose-card";
import { queuedFor, useNow, useOffline, useQueued } from "./live";

/** The Zycortal countdown as the top bar shows it, worked out on the server. */
export type InjectionStat = {
  label: string;
  fig: string;
  sub: string;
  overdue: boolean;
  /** How far through the cycle today is, 0 to 1. */
  part: number;
  days: number;
};

/**
 * The desktop top bar's live figures: the next dose with the day so far, the
 * injection countdown with its cycle, and who is up to date. Each figure has
 * its source line beneath; only an alert gives one a coloured tile.
 */
export function TodayStats({
  next,
  tomorrow,
  slots,
  injection,
  household,
  at,
  timeZone,
  serverNow,
}: {
  next: DoseView | null;
  tomorrow: boolean;
  /** Today's dose times, marked on the day's instrument. */
  slots: string[];
  injection: InjectionStat | null;
  /** "Adebayo and Sam" */
  household: string;
  at: string;
  timeZone: string;
  serverNow: number;
}) {
  const now = useNow(serverNow);
  const queued = useQueued();
  const offline = useOffline();
  const dayPart = (dayPercent(toLocal(new Date(now), timeZone).time) / 100).toFixed(4);

  let nextStat = null;
  if (next) {
    const waiting = tomorrow ? null : queuedFor(queued, next.planItemId, next.slot, timeZone, now);
    const late = !tomorrow && !waiting && next.ticks.length === 0 && now >= next.dueAt + LATE_AFTER_MS;
    const what = [next.med, next.amount].filter(Boolean).join(" ");
    const sub = waiting
      ? `Given ${toLocal(new Date(waiting.givenAt), timeZone).time} · on this computer only`
      : late
        ? `Not recorded yet · ${untilText(new Date(next.dueAt), new Date(now))}`
        : `${what} · ${tomorrow ? "tomorrow" : untilText(new Date(next.dueAt), new Date(now))}`;
    nextStat = (
      <div className={late ? "stat k-pred is-warn" : "stat k-pred"}>
        <dt>Next dose</dt>
        <dd className="stat-fig">{next.slot}</dd>
        <dd className="stat-sub">{sub}</dd>
        <dd className="stat-micro m-day" style={{ "--p": dayPart } as CSSProperties} aria-hidden="true">
          {[...new Set(slots)].map((s) => (
            <i key={s} style={{ left: `${dayPercent(s)}%` }} />
          ))}
        </dd>
      </div>
    );
  }

  return (
    <dl className="stats d-only" aria-label="At a glance">
      {nextStat}
      {injection && (
        <div className={injection.overdue ? "stat k-zyc is-alert" : "stat k-zyc"}>
          <dt>{injection.label}</dt>
          <dd className="stat-fig">{injection.fig}</dd>
          <dd className="stat-sub">{injection.sub}</dd>
          <dd
            className="stat-micro m-cycle"
            style={{ "--p": injection.part.toFixed(4), "--n": injection.days } as CSSProperties}
            aria-hidden="true"
          />
        </div>
      )}
      <div className={offline ? "stat k-sync is-warn" : "stat k-sync"}>
        <dt>Household</dt>
        <dd className="stat-fig">{offline ? "No signal" : household}</dd>
        <dd className="stat-sub">{offline ? `As of ${at}` : `Up to date at ${at}`}</dd>
      </div>
    </dl>
  );
}
