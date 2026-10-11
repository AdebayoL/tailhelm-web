"use client";

import { Fragment, useState } from "react";
import { Icon } from "@/app/_components/icon";
import { Sheet } from "@/app/_components/sheet";
import { toLocal } from "@/engine/time";
import { LATE_AFTER_MS } from "@/lib/today/today";
import { dayPercent } from "@/lib/today/view";
import type { QueuedTick } from "@/lib/offline/ticks";
import { SyncLine } from "../../_components/sync-line";
import { undoTick } from "./actions";
import { type DoseView, ThisDevice } from "./dose-card";
import { GuardSheet, type Vet } from "./guard-sheet";
import { queuedFor, useNow, useQueued, useTick } from "./live";

type Kind = "given" | "due" | "late" | "local";
type Row = DoseView & { kind: Kind; waiting: QueuedTick | null; key: string };

const STATUS_ICON = { given: "recorded", due: "due", late: "alert", local: "thisPhone" } as const;

function rowsFor(doses: DoseView[], queued: QueuedTick[], timeZone: string, now: number): Row[] {
  return doses.map((d) => {
    const waiting = d.ticks.length === 0 ? queuedFor(queued, d.planItemId, d.slot, timeZone, now) : null;
    const kind: Kind =
      d.ticks.length > 0 ? "given" : waiting ? "local" : now >= d.dueAt + LATE_AFTER_MS ? "late" : "due";
    return { ...d, kind, waiting, key: `${d.planItemId}|${d.slot}` };
  });
}

/**
 * Today's doses: on a phone, the care-record list; on a desktop, the day on
 * one 24-hour rail above the same records in columns. Every record says who
 * made it and when.
 */
export function DoseList({
  doses,
  nextKey,
  checkTimes,
  shared,
  at,
  dateShort,
  dogName,
  vet,
  timeZone,
  serverNow,
}: {
  doses: DoseView[];
  /** The dose on the next-dose card, which has its own Given. */
  nextKey: string | null;
  /** When each check was ticked today, for the rail. */
  checkTimes: string[];
  shared: string;
  at: string;
  /** "Sun 11 Oct" */
  dateShort: string;
  dogName: string;
  vet: Vet;
  timeZone: string;
  serverNow: number;
}) {
  const now = useNow(serverNow);
  const queued = useQueued();
  const [state, action, pending] = useTick(timeZone);
  const [guard, setGuard] = useState<{ at: number; row: Row } | null>(null);
  const [asking, setAsking] = useState(false);
  const [lastRow, setLastRow] = useState<Row | null>(null);
  const rows = rowsFor(doses, queued, timeZone, now);
  const nowTime = toLocal(new Date(now), timeZone).time;

  // Only a new result opens the guard or closes the question, so react to each result once, as it arrives.
  const [handled, setHandled] = useState(state);
  if (handled !== state) {
    setHandled(state);
    if (state.alreadyGiven && state.at && lastRow) setGuard({ at: state.at, row: lastRow });
    if (state.done) setAsking(false);
  }

  const mineLast = (r: Row) => [...r.ticks].reverse().find((t) => t.mine);
  const statusText = (r: Row, wide: boolean) => {
    if (r.kind === "given") return wide ? "Given" : `Given ${r.ticks[0].at} by ${r.ticks[0].by}`;
    if (r.kind === "late") return `Not recorded · due at ${r.slot}`;
    if (r.kind === "local") {
      const t = toLocal(new Date(r.waiting!.givenAt), timeZone).time;
      return wide ? (
        <>
          Given, on <ThisDevice /> only
        </>
      ) : (
        <>
          Given {t} by you, on <ThisDevice /> only
        </>
      );
    }
    return `Due at ${r.slot}`;
  };

  const record = (r: Row) =>
    r.kind !== "given" && r.kind !== "local" && r.key !== nextKey ? (
      <form action={action} onSubmit={() => setLastRow(r)}>
        <input type="hidden" name="plan_item_id" value={r.planItemId} />
        <input type="hidden" name="slot" value={r.slot} />
        <input type="hidden" name="product" value={r.product ?? ""} />
        <button className="lnk" type="submit" disabled={pending}>
          Record as given
        </button>
      </form>
    ) : null;

  const undo = (r: Row) => {
    const mine = mineLast(r);
    return mine ? (
      <form action={undoTick}>
        <input type="hidden" name="treatment_id" value={mine.id} />
        <button className="lnk" type="submit">
          Undo{r.ticks.length > 1 ? (mine.extra ? " second dose" : "") : ""}
        </button>
      </form>
    ) : null;
  };

  const extras = (r: Row) =>
    r.ticks.slice(1).map((t) => (
      <span key={t.id} className="block">
        Second dose {t.at} by {t.by}
      </span>
    ));

  // The rail: one mark per time, showing the dose there that most needs looking at.
  const order: Kind[] = ["late", "due", "local", "given"];
  const marks = [...new Set(rows.map((r) => r.slot))].map((slot) => {
    const here = rows.filter((r) => r.slot === slot);
    return { slot, kind: order.find((k) => here.some((r) => r.kind === k))! };
  });
  const railLabel = [
    ...rows.map((r) =>
      r.kind === "given"
        ? `${r.slot} ${r.med} given at ${r.ticks[0].at} by ${r.ticks[0].by}`
        : r.kind === "late"
          ? `${r.slot} ${r.med} not recorded`
          : r.kind === "local"
            ? `${r.slot} ${r.med} saved on this device at ${toLocal(new Date(r.waiting!.givenAt), timeZone).time}, not shared yet`
            : `${r.slot} ${r.med} due`,
    ),
    `now ${nowTime}`,
  ].join("; ");
  const nowPct = dayPercent(nowTime);
  const edge = nowPct < 4 ? "none" : nowPct > 96 ? "translateX(-100%)" : undefined;

  const anyGiven = rows.some((r) => r.kind === "given");
  const messages = (
    <>
      {state.failed && (
        <p className="err" role="alert">
          <Icon name="attention" />
          This wasn&rsquo;t recorded. Try again in a minute.
        </p>
      )}
      {state.needsSignal && (
        <p className="err" role="alert">
          <Icon name="attention" />A second dose can only be recorded with a signal, so the household sees it straight
          away.
        </p>
      )}
    </>
  );
  const second = anyGiven && (
    <button className="lnk" type="button" onClick={() => setAsking(true)} style={{ alignSelf: "flex-start" }}>
      <Icon name="add" size={20} />
      Record a second dose
    </button>
  );

  return (
    <>
      <section className="sec m-only o-2" aria-label="Today's doses">
        <div className="sec-h">
          <h2 className="sec-t">Today&rsquo;s doses</h2>
          <span className="sec-meta">{dateShort}</span>
        </div>
        <ol className="recs">
          {rows.map((r) => (
            <li key={r.key} className="rec">
              <span className="rec-time">{r.slot}</span>
              <div>
                <p className="rec-med">
                  <b>{r.med}</b>
                  {r.amount && ` ${r.amount}`}
                </p>
                <p className={r.kind === "due" ? "st" : `st ${r.kind}`}>
                  <Icon name={STATUS_ICON[r.kind]} />
                  <span>
                    {statusText(r, false)}
                    {extras(r)}
                  </span>
                </p>
                {(undo(r) || record(r)) && (
                  <div className="rec-acts">
                    {undo(r)}
                    {record(r)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {messages}
        {second}
        <SyncLine shared={shared} at={at} />
      </section>

      <section className="card lg stack-24 d-only" aria-label="Today's doses">
        <div className="sec-h">
          <h2 className="d-h">Today&rsquo;s doses</h2>
          <span className="sec-meta" style={{ fontSize: 16 }}>
            {dateShort}
          </span>
        </div>
        <div className="stack-8">
          <div className="rail" role="img" aria-label={railLabel}>
            <div className="rail-track" />
            <div className="rail-past" style={{ width: `${nowPct}%` }} />
            {[0, 25, 50, 75, 100].map((p) => (
              <span key={p} className="rail-tick" style={{ left: `${p}%` }} />
            ))}
            {["00:00", "06:00", "12:00", "18:00", "24:00"].map((h, i) => (
              <span key={h} className={i === 0 ? "rail-hour first" : i === 4 ? "rail-hour last" : "rail-hour"} style={{ left: `${i * 25}%` }}>
                {h}
              </span>
            ))}
            {[...new Set(checkTimes)].map((t) => (
              <span key={t} className="rail-check" style={{ left: `${dayPercent(t)}%` }} />
            ))}
            <span className="rail-now" style={{ left: `${nowPct}%` }} />
            <span className="rail-nowlbl" style={{ left: `${nowPct}%`, transform: edge }}>
              Now {nowTime}
            </span>
            {marks.map((m) => (
              <Fragment key={m.slot}>
                <span className="rail-lbl" style={{ left: `${dayPercent(m.slot)}%` }}>
                  {m.slot}
                </span>
                <span className={`rail-mark k-${m.kind}`} style={{ left: `${dayPercent(m.slot)}%` }}>
                  <Icon name={m.kind === "local" ? "localTick" : STATUS_ICON[m.kind]} />
                </span>
              </Fragment>
            ))}
          </div>
          <div className="rail-legend">
            <span>
              <Icon name="recorded" size={16} />
              Dose given
            </span>
            <span>
              <Icon name="due" size={16} />
              Dose due
            </span>
            <span>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--text-2)" }} />
              Check ticked
            </span>
            <span>
              <span style={{ width: 2, height: 14, background: "var(--text)" }} />
              Now
            </span>
          </div>
        </div>
        <div role="table" aria-label="Doses today">
          <div role="row" className="dose-grid dose-head">
            {["Time", "Medicine", "Status", "Recorded"].map((h) => (
              <span key={h} role="columnheader" className="ty-label c2">
                {h}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.key} role="row" className="dose-grid dose-row">
              <span role="cell" className="rec-time">
                {r.slot}
              </span>
              <span role="cell">
                <b className="w6">{r.med}</b>
                {r.amount && ` ${r.amount}`}
              </span>
              <span role="cell" className={`st ${r.kind}`}>
                <Icon name={r.kind === "local" ? "thisComputer" : STATUS_ICON[r.kind]} />
                <span>{statusText(r, true)}</span>
              </span>
              <span role="cell" className="c2 tn stack-4" style={{ alignItems: "flex-start" }}>
                <span>
                  {r.kind === "given"
                    ? `${r.ticks[0].at} by ${r.ticks[0].by}`
                    : r.kind === "local"
                      ? `${toLocal(new Date(r.waiting!.givenAt), timeZone).time} by you`
                      : "Not yet"}
                  {extras(r)}
                </span>
                {undo(r)}
                {record(r)}
              </span>
            </div>
          ))}
        </div>
        {messages}
        {second}
        <SyncLine shared={shared} at={at} onlineOnly />
      </section>

      {asking && (
        <SecondDoseSheet
          rows={rows.filter((r) => r.kind === "given")}
          dogName={dogName}
          action={action}
          pending={pending}
          onPick={setLastRow}
          onClose={() => setAsking(false)}
        />
      )}
      {guard && state.alreadyGiven && (
        <GuardSheet
          by={state.alreadyGiven.by}
          at={state.alreadyGiven.at}
          slot={guard.row.slot}
          med={{ name: guard.row.med, amount: guard.row.amount }}
          dogName={dogName}
          vet={vet}
          onClose={() => setGuard(null)}
        />
      )}
    </>
  );
}

/** A second dose of one already given today. Only on the vet's say-so, and only with a signal. */
function SecondDoseSheet({
  rows,
  dogName,
  action,
  pending,
  onPick,
  onClose,
}: {
  rows: Row[];
  dogName: string;
  action: (form: FormData) => void;
  pending: boolean;
  onPick: (r: Row) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState(rows[0]?.key ?? "");
  const row = rows.find((r) => r.key === pick) ?? rows[0];
  return (
    <Sheet label="Record a second dose" onClose={onClose}>
      <h2 className="ty-page">Record a second dose</h2>
      <p className="ty-lead sheet-lead">Only if your vet told you to give {dogName} another dose today.</p>
      <form action={action} onSubmit={() => row && onPick(row)} className="stack-16">
        <input type="hidden" name="plan_item_id" value={row?.planItemId ?? ""} />
        <input type="hidden" name="slot" value={row?.slot ?? ""} />
        <input type="hidden" name="product" value={row?.product ?? ""} />
        <input type="hidden" name="second_dose" value="confirmed" />
        <fieldset className="field">
          <legend className="lbl">Which dose</legend>
          <div>
            {rows.map((r) => (
              <label key={r.key} className="radio">
                <input type="radio" name="pick" value={r.key} checked={pick === r.key} onChange={() => setPick(r.key)} />
                <span className="tn">
                  {r.slot} · <b className="w6">{r.med}</b>
                  {r.amount && ` ${r.amount}`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sheet-actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record second dose"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}
