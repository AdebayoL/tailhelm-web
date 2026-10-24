"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { formatDate } from "@/lib/plan/input";
import { useClock, useDeviceWord, useKeptCaptures, useOnline } from "@/lib/happening/hooks";
import { type LocalCapture, forgetCapture, readCaptures, runningIn, startCapture, stopCapture } from "@/lib/happening/local";
import { finishedAs, sendCapture } from "@/lib/happening/sync";
import { type LiveThreshold, clockText, lastedText, passedThresholds, spokenTime } from "@/lib/happening/timer";
import { checkCapture } from "./actions";

export type TimerData = {
  dogId: string;
  dogName: string;
  timeZone: string;
  /** The vet's numbers, in the order Emergency shows them. */
  calls: { title: string; sub: string | null; phone: string; who: string | null; href: string }[];
  why: string | null;
  thresholds: LiveThreshold[];
  /** The capture Tailhelm has running for the dog, and who started it (null for the person signed in). */
  running: { id: string; startedAt: string; by: string | null } | null;
  /** The vet's written emergency plan, exactly as entered. */
  plan: { words: string; provenance: string } | null;
};

type Current = { id: string; dogId: string; startedAt: string; by: string | null };
type Stopped = { id: string; startedAt: string; endedAt: string; status: "sending" | "saved" | "waiting" | "removed"; elsewhere: boolean };

/** How often a running timer checks whether another phone stopped it. */
const CHECK_MS = 15_000;

const noChange = () => () => {};

/*
 * What "It has stopped" showed, kept outside the component so it survives the
 * page swapping its loading copy of the timer for the full one.
 */
let stoppedNow: Stopped | null = null;
const stoppedListeners = new Set<() => void>();
function setStoppedNow(next: Stopped | null | ((prev: Stopped | null) => Stopped | null)) {
  stoppedNow = typeof next === "function" ? next(stoppedNow) : next;
  for (const l of stoppedListeners) l();
}
function subscribeStopped(onChange: () => void) {
  stoppedListeners.add(onChange);
  return () => {
    stoppedListeners.delete(onChange);
  };
}

/**
 * The timer itself. It counts from the start time, never from the page
 * opening, so it stays right through a call, the screen locking or no
 * signal. With `data` null it is still loading, and shows any timer this
 * phone has running from its own copy.
 */
export function Timer({ data, noDog = false }: { data: TimerData | null; noDog?: boolean }) {
  const kept = useKeptCaptures();
  const online = useOnline();
  const device = useDeviceWord();
  const now = useClock();
  const stopped = useSyncExternalStore(subscribeStopped, () => stoppedNow, () => null);
  // Captures stopped on another phone or removed since this page loaded, which its data still shows running.
  const [dropped, setDropped] = useState<string[]>([]);
  const canLock = useSyncExternalStore(noChange, () => "wakeLock" in navigator, () => true);
  const [lockFailed, setLockFailed] = useState(false);
  const [called, setCalled] = useState(false);
  const started = useRef(false);

  const timeZone = data?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const current = currentCapture(kept, data, dropped);
  // A stop shows until another capture starts; until then nothing counts or checks.
  const showStopped = stopped !== null && stopped.status !== "removed" && (!current || current.id === stopped.id);

  // A tap on Happening now starts the timer before this page opens; if it couldn't, start it now.
  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("start") !== "1") return;
    window.history.replaceState(null, "", url.pathname);
    // Read from storage, not the first render, which can't see it yet.
    const list = readCaptures();
    // Someone else's timer is running for the dog: this phone shows theirs rather than a second one.
    const theirs = data.running && navigator.onLine && !list.some((c) => c.id === data.running?.id && c.endedAt);
    if (!runningIn(list, data.dogId) && !theirs) {
      setStoppedNow(null);
      startCapture(data.dogId);
    }
  }, [data]);

  // Keep the screen on while it runs, and again each time the page comes back into view.
  const runningId = showStopped ? null : (current?.id ?? null);
  useEffect(() => {
    if (!runningId || !canLock) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (alive) lock = l;
          else void l.release();
        },
        () => setLockFailed(true),
      );
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, [runningId, canLock]);

  // If another phone in the household stops it, or the person who started it removes it, stop here too.
  const sent = current ? !kept.some((c) => c.id === current.id && !c.sentStart) : false;
  const startedAt = current?.startedAt ?? null;
  useEffect(() => {
    if (!runningId || !sent || !online) return;
    const check = () =>
      void checkCapture(runningId).then(
        (r) => {
          if (!("stoppedAt" in r) && !("gone" in r)) return;
          forgetCapture(runningId);
          setDropped((ids) => [...ids, runningId]);
          setStoppedNow(
            "stoppedAt" in r
              ? { id: runningId, startedAt: startedAt ?? r.stoppedAt, endedAt: r.stoppedAt, status: "saved", elsewhere: true }
              : { id: runningId, startedAt: startedAt ?? new Date().toISOString(), endedAt: new Date().toISOString(), status: "removed", elsewhere: false },
          );
        },
        () => undefined,
      );
    const timer = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [runningId, startedAt, sent, online]);

  const stop = () => {
    if (!current) return;
    const s = stopCapture(current, data?.thresholds ?? []);
    setStoppedNow({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, status: "sending", elsewhere: false });
    void sendCapture().then(() =>
      setStoppedNow((prev) => (prev && prev.id === s.id && prev.status === "sending" ? { ...prev, status: "waiting" } : prev)),
    );
  };

  if (stopped && showStopped) {
    // Saved once Tailhelm has it, whichever part of the app sent it, under the id it has there.
    const done = finishedAs(stopped.id);
    const view: Stopped = done
      ? { ...stopped, id: done.id, endedAt: done.stoppedAt ?? stopped.endedAt, elsewhere: stopped.elsewhere || done.stoppedAt !== null, status: "saved" }
      : stopped.status === "waiting" && !kept.some((c) => c.id === stopped.id)
        ? { ...stopped, status: "saved" }
        : stopped;
    return <StoppedView stopped={view} timeZone={timeZone} dogName={data?.dogName ?? null} call={data?.calls[0] ?? null} device={device} />;
  }

  if (!current) {
    if (noDog) {
      return (
        <main className="hn-body hn-end">
          <Heading />
          <p className="hn-lead hn-gap">Add your dog first, and Happening now times what is happening and shows your vet&rsquo;s numbers.</p>
          <div className="stack-12 hn-push">
            <Link className="hn-btn primary" href="/dog">
              Add your dog
            </Link>
            <Link className="hn-btn secondary" href="/today">
              Back to Today
            </Link>
          </div>
        </main>
      );
    }
    if (!data) {
      return (
        <main className="hn-body hn-end" aria-busy="true">
          <Heading />
        </main>
      );
    }
    return (
      <main className="hn-body hn-end">
        <Heading />
        <p className="hn-big hn-gap">
          {stopped?.status === "removed" ? "The person who started this timer removed it. " : ""}
          Nothing is being timed for {data.dogName}.
        </p>
        <div className="stack-12 hn-push">
          <button
            type="button"
            className="hn-stop"
            onClick={() => {
              setStoppedNow(null);
              startCapture(data.dogId);
            }}
          >
            <Icon name="stopwatch" size={28} />
            Start the timer
          </button>
          <Link className="hn-btn secondary" href="/today">
            Back to Today
          </Link>
        </div>
      </main>
    );
  }

  const elapsed = now === null ? null : Math.max(0, now - Date.parse(current.startedAt));
  const passed = elapsed === null ? [] : passedThresholds(data?.thresholds ?? [], elapsed);
  const startTime = toLocal(new Date(current.startedAt), timeZone).time;
  const spoken = elapsed === null ? "" : spokenTime(elapsed);
  const notes = [
    !online && { key: "signal", icon: "noSignal", text: `No signal. The timer is running on this ${device} and is saved when there is a signal.` },
    called && { key: "called", icon: "stopwatch", text: "The timer kept running while you called." },
    (!canLock || lockFailed) && { key: "dim", icon: "dim", text: `This ${device} may dim the screen. The timer keeps running.` },
  ].filter((n): n is { key: string; icon: IconName; text: string } => Boolean(n));

  return (
    <main className="hn-body hn-run">
      <div className="hn-top">
        <Heading dogName={data?.dogName} />
        <Link className="hn-btn secondary hn-top-back" href="/today">
          Back to Today
        </Link>
      </div>

      <div className="hn-left">
        {passed.map((t) => (
          <div key={t.key} className="hn-limit" role="alert">
            <Icon name="alert" size={28} />
            <span>
              {t.ownerWording}
              {t.cite && <span className="cite">{t.cite}</span>}
            </span>
          </div>
        ))}
        <div className="hn-clockblock">
          <p className={passed.length > 0 ? "hn-clock s" : elapsed !== null && elapsed >= 3_600_000 ? "hn-clock h" : "hn-clock"} role="timer" aria-live="off">
            {elapsed === null ? "0:00" : clockText(elapsed)}
          </p>
          <p className="hn-started">{current.by ? `${current.by} started it at ${startTime}` : `Started at ${startTime}`}</p>
          <p className="sr" aria-live="polite">
            {spoken && `Happening now${data ? ` for ${data.dogName}` : ""}: ${spoken === "Under a minute" ? "under a minute" : spoken} so far.`}
          </p>
        </div>
        {notes.length > 0 && (
          <div className="hn-notes" role="status">
            {notes.map((n) => (
              <p key={n.key} className="hn-note">
                <Icon name={n.icon} />
                <span>{n.text}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="hn-right">
        {!data ? (
          <>
            <div className="hn-calls" aria-busy="true">
              <div className="hn-call pending">
                <Icon name="call" size={32} />
                <span>
                  <span className="l1">Your vets</span>
                  <span className="l2">Getting the numbers you saved</span>
                </span>
              </div>
              <div className="hn-call second pending" />
            </div>
            <p className="hn-order">The timer is already running. The call buttons appear here as soon as the numbers arrive.</p>
          </>
        ) : data.calls.length > 0 ? (
          <>
            <div className="hn-calls">
              {data.calls.map((c, i) => (
                <a
                  key={c.href}
                  className={i > 0 ? "hn-call second" : passed.length > 0 ? "hn-call first big" : "hn-call first"}
                  href={c.href}
                  onClick={() => setCalled(true)}
                >
                  <Icon name="call" size={32} />
                  <span>
                    <span className="l1">{c.title}</span>
                    {i === 0 ? (
                      <>
                        {c.sub && <span className="l2">{c.sub}</span>}
                        <span className="num">{c.phone}</span>
                      </>
                    ) : (
                      <span className="l2">{c.sub ? `${c.sub} · ${c.phone}` : c.phone}</span>
                    )}
                  </span>
                </a>
              ))}
            </div>
            {data.why && <p className="hn-order">{data.why}</p>}
          </>
        ) : (
          <p className="hn-quiet">
            <Icon name="info" />
            <span>
              No vet numbers yet. They are added on the Dog tab, and appear here from then on. <Link href="/dog">Open the Dog tab</Link>
            </span>
          </p>
        )}

        {data?.plan && (
          <section className="hn-plan" aria-labelledby="hn-plan-t">
            <h2 className="lab" id="hn-plan-t">
              Your vet&rsquo;s emergency plan
            </h2>
            <blockquote>&ldquo;{data.plan.words}&rdquo;</blockquote>
            <p className="prov2">{data.plan.provenance}</p>
          </section>
        )}
      </div>

      <Link className="hn-link hn-foot-back" href="/today">
        Back to Today
      </Link>

      <div className="hn-bar">
        <button type="button" className="hn-stop" onClick={stop}>
          <span className="sq" aria-hidden="true" />
          It has stopped
        </button>
      </div>
    </main>
  );
}

/** The screen's heading, where focus lands when it opens. */
function Heading({ dogName }: { dogName?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 className="hn-head" ref={ref} tabIndex={-1}>
      <Icon name="stopwatch" size={28} />
      Happening now{dogName ? ` · ${dogName}` : ""}
    </h1>
  );
}

/** What this phone shows as running: its own timer first, then the one Tailhelm has, unless this phone has already stopped that. */
function currentCapture(kept: LocalCapture[], data: TimerData | null, dropped: string[]): Current | null {
  const mine = data ? runningIn(kept, data.dogId) : ([...kept].reverse().find((c) => c.endedAt === null) ?? null);
  if (mine) {
    const by = data?.running && data.running.id === mine.id ? data.running.by : null;
    return { id: mine.id, dogId: mine.dogId, startedAt: mine.startedAt, by };
  }
  const theirs = data?.running;
  if (!data || !theirs || dropped.includes(theirs.id) || kept.some((c) => c.id === theirs.id)) return null;
  return { id: theirs.id, dogId: data.dogId, startedAt: theirs.startedAt, by: theirs.by };
}

/** "It has stopped": the same dark screen a moment later, so there is no flash of white at night. The vet's number stays at the foot. */
function StoppedView({
  stopped,
  timeZone,
  dogName,
  call,
  device,
}: {
  stopped: Stopped;
  timeZone: string;
  dogName: string | null;
  call: TimerData["calls"][number] | null;
  device: "phone" | "computer";
}) {
  const status =
    stopped.status === "sending"
      ? { cls: "hn-status saving", icon: "saving" as const, text: "Saving…" }
      : stopped.status === "saved"
        ? { cls: "hn-status", icon: "saved" as const, text: `Saved for everyone who looks after ${dogName ?? "your dog"}.` }
        : { cls: "hn-status local", icon: device === "computer" ? ("thisComputer" as const) : ("thisPhone" as const), text: `Saved on this ${device}. It reaches Tailhelm when there is a signal.` };
  return (
    <main className="hn-body hn-end">
      <Heading dogName={dogName ?? undefined} />
      <p className="hn-clock frozen" aria-hidden="true">
        {clockText(Date.parse(stopped.endedAt) - Date.parse(stopped.startedAt))}
      </p>
      <div className="stack-8">
        <h2 className="hn-big">It has stopped</h2>
        <p className="hn-lead">{lastedText(stopped.startedAt, stopped.endedAt, timeZone, formatDate)}</p>
      </div>
      {stopped.elsewhere && (
        <p className="hn-status quiet">
          <Icon name="info" size={28} />
          <span>It was stopped on another phone first, so that time is kept.</span>
        </p>
      )}
      <p className={status.cls} role="status">
        <Icon name={status.icon} size={28} />
        <span>{status.text}</span>
      </p>
      <div className="stack-12 hn-acts">
        {stopped.status === "saved" ? (
          <>
            <Link className="hn-btn primary" href={`/happening-now/${stopped.id}`}>
              Add detail now
            </Link>
            <Link className="hn-btn secondary" href="/today">
              Later
            </Link>
            <p className="hn-small">Every detail is optional. A card on Today keeps this open for 48 hours.</p>
          </>
        ) : (
          <>
            <Link className="hn-btn secondary" href="/today">
              Back to Today
            </Link>
            <p className="hn-small">
              {stopped.status === "sending"
                ? "Saving takes a moment. The add-detail buttons appear here once it is saved."
                : "Once it reaches Tailhelm, a card on Today lets you add the detail for 48 hours."}
            </p>
          </>
        )}
      </div>
      {call && (
        <div className="hn-foot-call">
          <a className="hn-call first" href={call.href}>
            <Icon name="call" size={32} />
            <span>
              <span className="l1">{call.title}</span>
              <span className="l2">{call.who ? `${call.who} · ${call.phone}` : call.phone}</span>
            </span>
          </a>
        </div>
      )}
    </main>
  );
}
