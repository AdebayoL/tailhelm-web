"use client";

import { useActionState, useEffect, useState } from "react";
import { toLocal } from "@/engine/time";
import { QUEUE_CHANGED, queueTick, queuedTicks, removeQueuedTick } from "@/lib/offline/queue";
import { type QueuedTick, queuedTickKey } from "@/lib/offline/ticks";
import type { TickView } from "@/lib/today/today";
import { type TickState, tickDose, undoTick } from "./actions";

const given =
  "min-h-[72px] w-full rounded-2xl bg-green px-6 text-2xl font-semibold text-paper disabled:opacity-60";
const link = "min-h-12 text-lg text-green underline underline-offset-4";

type DoseTickState = TickState & { needsSignal?: boolean };

/**
 * One dose today: who gave it and when, or a single large Given button. The
 * time is recorded as now, so someone holding a lead types nothing. With no
 * signal the tick waits on the phone and is sent, at the time it was made,
 * once there is one.
 */
export function DoseTick({
  planItemId,
  slot,
  product,
  timeZone,
  ticks,
}: {
  planItemId: string;
  slot: string;
  product: string | null;
  timeZone: string;
  ticks: TickView[];
}) {
  const [waiting, setWaiting] = useState<QueuedTick | null>(null);

  // The tick for this dose waiting on the phone, if any; it may outlive the page.
  useEffect(() => {
    const load = () => {
      const key = queuedTickKey(planItemId, toLocal(new Date(), timeZone).date, slot);
      queuedTicks()
        .then((all) => setWaiting(all.find((t) => t.key === key) ?? null))
        .catch(() => setWaiting(null));
    };
    load();
    window.addEventListener(QUEUE_CHANGED, load);
    return () => window.removeEventListener(QUEUE_CHANGED, load);
  }, [planItemId, slot, timeZone]);

  const [state, action, pending] = useActionState<DoseTickState, FormData>(async (prev, form) => {
    const second = form.get("second_dose") === "confirmed";
    const queue = async (): Promise<DoseTickState> => {
      if (second) return { needsSignal: true };
      const now = new Date();
      const givenOn = toLocal(now, timeZone).date;
      await queueTick({
        key: queuedTickKey(planItemId, givenOn, slot),
        planItemId,
        slot,
        givenOn,
        givenAt: now.toISOString(),
        product,
      });
      return {};
    };
    if (!navigator.onLine) return queue();
    try {
      return await tickDose(prev, form);
    } catch {
      // The request never reached Tailhelm: keep the tick on the phone instead.
      return queue();
    }
  }, {});
  const [askingSecond, setAskingSecond] = useState(false);
  const lastMine = [...ticks].reverse().find((t) => t.mine);

  return (
    <div className="flex flex-col gap-3">
      {state.alreadyGiven && (
        <p role="alert" className="text-lg font-semibold">
          {state.alreadyGiven.by === "you" ? "You" : state.alreadyGiven.by}{" "}
          ticked this at {state.alreadyGiven.at}. It has not been recorded
          twice.
        </p>
      )}
      {state.failed && (
        <p role="alert" className="text-lg font-semibold">
          This wasn&rsquo;t recorded. Try again in a minute.
        </p>
      )}
      {state.needsSignal && (
        <p role="alert" className="text-lg font-semibold">
          A second dose can only be recorded with a signal, so the household sees it straight away.
        </p>
      )}

      {ticks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {ticks.map((t) => (
            <li key={t.id} className="text-lg">
              {t.extra ? "Second dose given" : "Given"} {t.at} by {t.by}
            </li>
          ))}
        </ul>
      )}

      {ticks.length === 0 && waiting ? (
        <div className="flex flex-col gap-1">
          <p className="text-lg">
            Given {toLocal(new Date(waiting.givenAt), timeZone).time} by you. No signal yet, so the
            household can&rsquo;t see it; it will be sent as soon as there is one.
          </p>
          <button type="button" onClick={() => void removeQueuedTick(waiting.key)} className={`${link} self-start`}>
            Undo my tick
          </button>
        </div>
      ) : ticks.length === 0 ? (
        <form action={action}>
          <input type="hidden" name="plan_item_id" value={planItemId} />
          <input type="hidden" name="slot" value={slot} />
          <button type="submit" disabled={pending} className={given}>
            {pending ? "Recording…" : "Given"}
          </button>
        </form>
      ) : askingSecond ? (
        <form
          action={action}
          onSubmit={() => setAskingSecond(false)}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="plan_item_id" value={planItemId} />
          <input type="hidden" name="slot" value={slot} />
          <input type="hidden" name="second_dose" value="confirmed" />
          <p className="text-lg font-semibold">
            Give a second dose? Only if your vet told you to.
          </p>
          <div className="flex gap-6">
            <button type="submit" disabled={pending} className={link}>
              Yes, my vet told me to
            </button>
            <button
              type="button"
              onClick={() => setAskingSecond(false)}
              className={link}
            >
              No
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-x-6">
          {lastMine && (
            <form action={undoTick}>
              <input type="hidden" name="treatment_id" value={lastMine.id} />
              <button type="submit" className={link}>
                Undo my tick
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setAskingSecond(true)}
            className={link}
          >
            Give a second dose
          </button>
        </div>
      )}
    </div>
  );
}
