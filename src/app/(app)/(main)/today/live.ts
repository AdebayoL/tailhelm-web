"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { toLocal } from "@/engine/time";
import { QUEUE_CHANGED, queueTick, queuedTicks } from "@/lib/offline/queue";
import { type QueuedTick, queuedTickKey } from "@/lib/offline/ticks";
import { type TickState, tickDose } from "./actions";

const MINUTE = 60_000;
const minute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

function subscribeClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 15_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** Now, to the minute: the server's time while the page loads, then the phone's, kept current. */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribeClock, () => minute(Date.now()), () => minute(serverNow));
}

function subscribeSignal(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribeSignal, () => !navigator.onLine, () => false);
}

/** The ticks waiting on this phone for a signal. */
export function useQueued(): QueuedTick[] {
  const [queued, setQueued] = useState<QueuedTick[]>([]);
  useEffect(() => {
    const load = () => {
      queuedTicks().then(setQueued, () => setQueued([]));
    };
    load();
    window.addEventListener(QUEUE_CHANGED, load);
    return () => window.removeEventListener(QUEUE_CHANGED, load);
  }, []);
  return queued;
}

export function queuedFor(queued: QueuedTick[], planItemId: string, slot: string, timeZone: string, now: number) {
  const key = queuedTickKey(planItemId, toLocal(new Date(now), timeZone).date, slot);
  return queued.find((t) => t.key === key) ?? null;
}

export type DoseTickState = TickState & { needsSignal?: boolean; queued?: boolean; at?: number };

/**
 * Records a dose as given now. With no signal the tick waits on the phone and
 * is sent, at the time it was made, once there is one. A second dose needs a
 * signal, so the household sees it straight away.
 */
export function useTick(timeZone: string) {
  return useActionState<DoseTickState, FormData>(async (prev, form) => {
    const planItemId = String(form.get("plan_item_id") ?? "");
    const slot = String(form.get("slot") ?? "");
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
        product: String(form.get("product") ?? "") || null,
      });
      return { queued: true, at: Date.now() };
    };
    if (!navigator.onLine) return queue();
    try {
      return { ...(await tickDose(prev, form)), at: Date.now() };
    } catch {
      // The request never reached Tailhelm: keep the tick on the phone instead.
      return queue();
    }
  }, {});
}
