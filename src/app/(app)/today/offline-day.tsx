"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toLocal } from "@/engine/time";
import { formatDate } from "@/lib/plan/input";
import { DoseTick } from "./dose-tick";

export type OfflineDose = { id: string; product: string | null; description: string; times: string[] };

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * When this page was kept on an earlier day and there is no signal, the doses
 * due on the phone's today, worked out from the plan the page was saved with,
 * so they can still be ticked. Ticks by others since then cannot be seen.
 */
export function OfflineDay({ savedOn, timeZone, doses }: { savedOn: string; timeZone: string; doses: OfflineDose[] }) {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    if (!offline) return;
    const check = () => setToday(toLocal(new Date(), timeZone).date);
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [offline, timeZone]);

  if (!offline || !today || today === savedOn || doses.length === 0) return null;
  const slots = doses
    .flatMap((d) => [...new Set(d.times)].map((slot) => ({ dose: d, slot })))
    .sort((a, b) => a.slot.localeCompare(b.slot));

  return (
    <section aria-labelledby="offline-day" className="flex flex-col gap-4 rounded-2xl border-2 border-green p-5">
      <h2 id="offline-day" className="text-2xl font-semibold leading-snug">
        Today, {formatDate(today)}
      </h2>
      <p className="text-lg">
        No signal. These are the doses due today from {formatDate(savedOn)}&rsquo;s plan. Anyone else&rsquo;s ticks
        since then show once there is a signal. Everything below is from {formatDate(savedOn)}.
      </p>
      <ul className="flex flex-col gap-4">
        {slots.map(({ dose, slot }) => (
          <li key={`${dose.id}-${slot}`} className="flex flex-col gap-3 rounded-2xl border border-rule bg-card p-4">
            <p className="text-xl font-semibold">
              {slot} · {dose.product}
            </p>
            <p className="text-base">{dose.description}</p>
            <DoseTick planItemId={dose.id} slot={slot} product={dose.product} timeZone={timeZone} ticks={[]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
