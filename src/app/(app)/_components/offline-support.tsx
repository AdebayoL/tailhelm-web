"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/app/_components/icon";
import { keptPageSavedAt, startOfflineSupport } from "@/lib/offline/client";
import { type Outcome, QUEUE_CHANGED, dismissOutcome, outcomes, queuedTicks } from "@/lib/offline/queue";
import { sendWaitingTicks } from "@/lib/offline/sync";
import { CAPTURE_CHANGED, unsentCaptures } from "@/lib/happening/local";
import { type SendResult, sendCapture, settleCaptures } from "@/lib/happening/sync";
import { offlineBannerText, offlineUnseenText } from "@/lib/offline/text";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Registers the service worker, says when the phone has no signal, sends
 * ticks and Happening now timers made with no signal once there is one, and
 * says if any ticks could not be recorded as made.
 */
export function OfflineSupport({ shared = "", quiet = false }: { shared?: string; quiet?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState<Outcome[]>([]);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    // In development the service worker would serve stale pages while editing.
    if (process.env.NODE_ENV === "production") void startOfflineSupport();
  }, []);

  useEffect(() => {
    const load = () => {
      outcomes().then(setNotes, () => setNotes([]));
      queuedTicks().then((t) => setWaiting(t.length), () => setWaiting(0));
    };
    load();
    window.addEventListener(QUEUE_CHANGED, load);
    return () => window.removeEventListener(QUEUE_CHANGED, load);
  }, []);

  // Send waiting ticks whenever there is a signal, then show what the server now has.
  useEffect(() => {
    if (offline || waiting === 0) return;
    const send = () =>
      void sendWaitingTicks().then((sent) => {
        if (sent > 0) router.refresh();
      });
    send();
    // The phone can report a signal that does not reach Tailhelm; keep trying.
    const retry = window.setInterval(send, 60_000);
    return () => window.clearInterval(retry);
  }, [offline, waiting, router]);

  // Happening now timers kept on this phone: send each start and stop as soon as there is a signal.
  useEffect(() => {
    if (offline) return;
    let last: Promise<SendResult> | null = null;
    const send = () => {
      const sending = sendCapture();
      if (sending === last) return;
      last = sending;
      void sending.then((r) => {
        if (r.changed) router.refresh();
      });
    };
    send();
    // The timer screen checks for itself, so it can say who stopped it.
    if (!pathname.startsWith("/happening-now")) void settleCaptures();
    window.addEventListener(CAPTURE_CHANGED, send);
    const retry = window.setInterval(() => {
      if (unsentCaptures().length > 0) send();
    }, 60_000);
    return () => {
      window.removeEventListener(CAPTURE_CHANGED, send);
      window.clearInterval(retry);
    };
  }, [offline, router, pathname]);

  useEffect(() => {
    if (!offline) return;
    let current = true;
    void keptPageSavedAt(new URL(pathname, window.location.origin).href).then((d) => {
      if (current) setSavedAt(d);
    });
    return () => {
      current = false;
    };
  }, [offline, pathname]);

  if (quiet || (!offline && notes.length === 0)) return null;
  const unseen = offlineUnseenText(shared);
  return (
    <div className="app-status stack-8">
      {offline && (
        <div className="banner banner-warn" role="status">
          <Icon name="noSignal" />
          <div className="stack-4">
            <p className="tn r-lead">
              <b>No signal.</b> {offlineBannerText(savedAt, new Date())}
            </p>
            {unseen && <p className="r-sm">{unseen}</p>}
          </div>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.id} className="banner banner-warn" role="alert">
          <Icon name="attention" />
          <div className="stack-4">
            <p className="tn">{n.text}</p>
            <button type="button" onClick={() => void dismissOutcome(n.id)} className="lnk" style={{ minHeight: 40, alignSelf: "flex-start" }}>
              OK
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
