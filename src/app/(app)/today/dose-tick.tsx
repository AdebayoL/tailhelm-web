"use client";

import { useActionState, useState } from "react";
import type { TickView } from "@/lib/today/today";
import { type TickState, tickDose, undoTick } from "./actions";

const given =
  "min-h-[72px] w-full rounded-2xl bg-green px-6 text-2xl font-semibold text-paper disabled:opacity-60";
const link = "min-h-12 text-lg text-green underline underline-offset-4";

/**
 * One dose today: who gave it and when, or a single large Given button. The
 * time is recorded as now, so someone holding a lead types nothing.
 */
export function DoseTick({
  planItemId,
  slot,
  ticks,
}: {
  planItemId: string;
  slot: string;
  ticks: TickView[];
}) {
  const [state, action, pending] = useActionState<TickState, FormData>(
    tickDose,
    {},
  );
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

      {ticks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {ticks.map((t) => (
            <li key={t.id} className="text-lg">
              {t.extra ? "Second dose given" : "Given"} {t.at} by {t.by}
            </li>
          ))}
        </ul>
      )}

      {ticks.length === 0 ? (
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
