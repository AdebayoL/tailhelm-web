"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { keptPageSavedAt, startOfflineSupport } from "@/lib/offline/client";
import { type Outcome, QUEUE_CHANGED, dismissOutcome, outcomes, queuedTicks } from "@/lib/offline/queue";
import { sendWaitingTicks } from "@/lib/offline/sync";
import { offlineBannerText } from "@/lib/offline/text";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const link = "min-h-12 text-lg text-green underline underline-offset-4";

/**
 * Registers the service worker, says when the phone has no signal, sends
 * ticks made with no signal once there is one, and says if any could not be
 * recorded as made.
 */
export function OfflineSupport() {
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

  return (
    <>
      {offline && (
        <p role="status" className="bg-sand px-4 py-2 text-center text-base text-ink">
          {offlineBannerText(savedAt, new Date())}
          {waiting > 0 && ` ${waiting === 1 ? "1 tick is" : `${waiting} ticks are`} waiting to be sent.`}
        </p>
      )}
      {notes.map((n) => (
        <div key={n.id} role="alert" className="mx-auto flex max-w-md flex-col gap-1 border-2 border-alert-amber px-4 py-3">
          <p className="text-lg font-semibold">{n.text}</p>
          <button type="button" onClick={() => void dismissOutcome(n.id)} className={`${link} self-start`}>
            OK
          </button>
        </div>
      ))}
    </>
  );
}
