"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import type { Jewel } from "@/lib/app/jewel";
import { untilText } from "@/lib/app/words";
import { removeQueuedTick } from "@/lib/offline/queue";
import { LATE_AFTER_MS, type TickView } from "@/lib/today/today";
import { undoTick } from "./actions";
import { GuardSheet, type Vet } from "./guard-sheet";
import { queuedFor, useNow, useQueued, useTick } from "./live";

/** One dose as the screens show it. Amounts are the owner's, exactly as entered from the vet's plan. */
export type DoseView = {
  planItemId: string;
  slot: string;
  dueAt: number;
  product: string | null;
  /** "Prednisolone" */
  med: string;
  /** "2.5 mg", as entered. */
  amount: string | null;
  /** "Bella's Prednisolone" */
  heading: string;
  /** "2.5 mg twice daily" */
  line: string;
  /** "(set by vet 12 Sep 2026)" */
  set: string | null;
  /** What the medicine is, as the design colours it. */
  jewel: Jewel;
  /** "Pr", on the medicine's tile. */
  tile: string;
  ticks: TickView[];
};

/** "Next dose" with the medicine's tile beside it. */
function NextDoseLabel({ dose }: { dose: DoseView }) {
  return (
    <span className="kick-med">
      {dose.tile && (
        <span className={`med ${dose.jewel}`} aria-hidden="true">
          {dose.tile}
        </span>
      )}
      Next dose
    </span>
  );
}

/** "This phone" or "this computer", whichever the person is holding. */
export function ThisDevice({ capital = false }: { capital?: boolean }) {
  return (
    <>
      <span className="m-only">{capital ? "This phone" : "this phone"}</span>
      <span className="d-only">{capital ? "This computer" : "this computer"}</span>
    </>
  );
}

/**
 * The next dose: when, what, and one large Given. Records the time and the
 * person, then confirms in place. Late, waiting for a signal and already
 * given each change the words as well as the colour.
 */
export function DoseCard({
  dose,
  tomorrow = false,
  shared,
  dogName,
  vet,
  timeZone,
  serverNow,
  className = "",
}: {
  dose: DoseView;
  /** Everything due today is recorded; this is tomorrow's first dose. */
  tomorrow?: boolean;
  shared: string;
  dogName: string;
  vet: Vet;
  timeZone: string;
  serverNow: number;
  className?: string;
}) {
  const now = useNow(serverNow);
  const queued = useQueued();
  const [state, action, pending] = useTick(timeZone);
  const [guardOpen, setGuardOpen] = useState<number | null>(null);
  // The dose just given here, confirmed in place until the page is next looked at.
  const [justGiven, setJustGiven] = useState<{ dose: DoseView; at: number } | null>(null);

  useEffect(() => {
    if (state.alreadyGiven && state.at) setGuardOpen(state.at);
    if (state.done && state.at) setJustGiven({ dose, at: state.at });
    // Only a new result should change what is shown, not a new dose from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!justGiven) return;
    const clear = () => setJustGiven(null);
    const timer = window.setTimeout(clear, 30_000);
    const onShow = () => document.visibilityState === "visible" && clear();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [justGiven]);

  const shown = justGiven?.dose ?? dose;
  const mine = justGiven ? [...shown.ticks].reverse().find((t) => t.mine) : undefined;
  const waiting = tomorrow ? null : queuedFor(queued, shown.planItemId, shown.slot, timeZone, now);
  const late = !tomorrow && !justGiven && !waiting && shown.ticks.length === 0 && now >= shown.dueAt + LATE_AFTER_MS;

  const kickerRight = tomorrow ? "tomorrow" : untilText(new Date(shown.dueAt), new Date(now));
  const what = (
    <div className="dose-what">
      <p className="r-fig">{shown.slot}</p>
      <div className="stack-4 dose-name">
        <h2 className="r-h-dose">{shown.heading}</h2>
        <p className="tn">
          {shown.line}
          {shown.set && <>{" "}<span className="c2 nowrap">{shown.set}</span></>}
        </p>
      </div>
    </div>
  );

  const form = (label: string) => (
    <form action={action} className="dose-given">
      <input type="hidden" name="plan_item_id" value={shown.planItemId} />
      <input type="hidden" name="slot" value={shown.slot} />
      <input type="hidden" name="product" value={shown.product ?? ""} />
      {pending ? (
        <button className="btn btn-primary btn-given is-loading" type="button" aria-busy="true">
          <span className="spin" aria-hidden="true" />
          Recording…
        </button>
      ) : (
        <button className="btn btn-primary btn-given" type="submit">
          <Icon name="tick" size={28} />
          {label}
        </button>
      )}
      <p className="prov">
        {late
          ? shared
            ? `Not sure whether it was given? Check with ${shared} first, or contact your vet.`
            : "Not sure whether it was given? Contact your vet."
          : shared
            ? `Records the time and your name, and shows it to ${shared} straight away.`
            : "Records the time and your name."}
      </p>
    </form>
  );

  let body;
  let label = "Next dose";
  let cls = "card lg dose-card";
  let kicker = (
    <div className="kicker">
      <NextDoseLabel dose={shown} />
      <span className="tn">{kickerRight}</span>
    </div>
  );

  if (justGiven) {
    const at = mine?.at ?? toLocal(new Date(justGiven.at), timeZone).time;
    body = (
      <div className="given-row" role="status">
        <p className="row gap-8 tn">
          <Icon name="tick" size={28} className="tick-in" />
          Given {at} by you
        </p>
        {mine && (
          <form action={undoTick}>
            <input type="hidden" name="treatment_id" value={mine.id} />
            <button className="lnk" type="submit" style={{ padding: "0 8px" }}>
              Undo
            </button>
          </form>
        )}
      </div>
    );
  } else if (waiting) {
    label = "Dose saved on this phone";
    kicker = (
      <div className="kicker">
        <NextDoseLabel dose={shown} />
        <span className="chip chip-dashed">
          <Icon name="thisPhone" className="m-only" />
          <Icon name="thisComputer" className="d-only" />
          <span>
            Saved on <ThisDevice />
          </span>
        </span>
      </div>
    );
    body = (
      <div className="local-wrap">
        <div className="panel local-panel">
          <div className="stack-4">
            <p className="st local">
              <Icon name="thisPhone" className="m-only" />
              <span>
                Given {toLocal(new Date(waiting.givenAt), timeZone).time} by you. Saved on <ThisDevice /> only, not shared
                yet.
              </span>
            </p>
            <p className="ty-sm c2 local-note">
              {shared
                ? `${shared} can’t see this until you’re back online. Tailhelm will share it then and check it against ${shared}’s records.`
                : "Tailhelm will record it once you’re back online."}
            </p>
          </div>
          <button className="lnk d-only" type="button" onClick={() => void removeQueuedTick(waiting.key)}>
            Undo
          </button>
        </div>
        <button className="lnk m-only" type="button" onClick={() => void removeQueuedTick(waiting.key)}>
          Undo
        </button>
      </div>
    );
  } else if (tomorrow) {
    body = <p className="prov">Everything due today is recorded.</p>;
  } else {
    if (late) {
      label = "Dose not recorded yet";
      cls += " is-warn";
      kicker = (
        <div className="kicker">
          <span className="chip chip-warn">
            <Icon name="alert" />
            Not recorded yet
          </span>
          <span className="tn">{kickerRight}</span>
        </div>
      );
    }
    body = form("Given");
  }

  return (
    <section className={`${cls} ${className}`.trim()} aria-label={label}>
      {kicker}
      {what}
      {body}
      {state.failed && (
        <p className="err" role="alert">
          <Icon name="attention" />
          This wasn&rsquo;t recorded. Try again in a minute.
        </p>
      )}
      {guardOpen !== null && state.alreadyGiven && (
        <GuardSheet
          by={state.alreadyGiven.by}
          at={state.alreadyGiven.at}
          slot={shown.slot}
          med={{ name: shown.med, amount: shown.amount, jewel: shown.jewel }}
          dogName={dogName}
          vet={vet}
          onClose={() => setGuardOpen(null)}
        />
      )}
    </section>
  );
}
