"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { weekdayDayMonth } from "@/lib/app/dates";
import { hasOrHave } from "@/lib/app/words";
import { removeQueuedTick } from "@/lib/offline/queue";
import { ThisDevice } from "./dose-card";
import { queuedFor, useOffline, useQueued, useTick } from "./live";

export type OfflineDose = { id: string; product: string | null; med: string; amount: string | null; times: string[] };

/**
 * When this page was kept on an earlier day and there is no signal, the doses
 * due on the phone's today, worked out from the plan the page was saved with,
 * so they can still be ticked. Ticks by others since then cannot be seen.
 */
export function OfflineDay({
  savedOn,
  timeZone,
  doses,
  shared,
}: {
  savedOn: string;
  timeZone: string;
  doses: OfflineDose[];
  shared: string;
}) {
  const offline = useOffline();
  const queued = useQueued();
  const [, action, pending] = useTick(timeZone);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!offline) return;
    const check = () => setNow(Date.now());
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [offline]);

  const today = now === null ? null : toLocal(new Date(now), timeZone).date;
  if (!offline || !today || now === null || today === savedOn || doses.length === 0) return null;
  const slots = doses
    .flatMap((d) => [...new Set(d.times)].map((slot) => ({ dose: d, slot })))
    .sort((a, b) => a.slot.localeCompare(b.slot));

  return (
    <section className="card lg stack-16 o-1" aria-label="Today's doses, from this phone">
      <div className="kicker">
        <span>Today&rsquo;s doses · {weekdayDayMonth(today)}</span>
        <span className="chip chip-dashed">
          <Icon name="thisPhone" className="m-only" />
          <Icon name="thisComputer" className="d-only" />
          <span>
            From <ThisDevice />
          </span>
        </span>
      </div>
      <p className="ty-lead">
        These are the doses due today, from the plan saved on <ThisDevice /> on {weekdayDayMonth(savedOn)}.
      </p>
      <ol className="recs">
        {slots.map(({ dose, slot }) => {
          const waiting = queuedFor(queued, dose.id, slot, timeZone, now);
          return (
            <li key={`${dose.id}-${slot}`} className="rec">
              <span className="rec-time">{slot}</span>
              <div>
                <p className="rec-med">
                  <b>{dose.med}</b>
                  {dose.amount && ` ${dose.amount}`}
                </p>
                {waiting ? (
                  <>
                    <p className="st local">
                      <Icon name="thisPhone" />
                      <span>
                        Given {toLocal(new Date(waiting.givenAt), timeZone).time} by you, on <ThisDevice /> only
                      </span>
                    </p>
                    <button className="lnk" type="button" onClick={() => void removeQueuedTick(waiting.key)}>
                      Undo
                    </button>
                  </>
                ) : (
                  <form action={action} style={{ marginTop: 12 }}>
                    <input type="hidden" name="plan_item_id" value={dose.id} />
                    <input type="hidden" name="slot" value={slot} />
                    <input type="hidden" name="product" value={dose.product ?? ""} />
                    <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                      <Icon name="tick" size={20} />
                      Given
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="prov">
        {shared ? `Anything ${shared} ${hasOrHave(shared)} recorded since then shows once you’re back online. ` : ""}
        The rest of this page is from {weekdayDayMonth(savedOn)}.
      </p>
    </section>
  );
}
