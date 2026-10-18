"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CAPTURE_CHANGED, KEY, type LocalCapture, parseLocal } from "./local";

function subscribe(onChange: () => void) {
  window.addEventListener(CAPTURE_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CAPTURE_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The captures kept on this phone, kept current as they change here or in another tab. Empty on the server. */
export function useKeptCaptures(): LocalCapture[] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parseLocal(raw), [raw]);
}

/*
 * One clock for every running timer on the page, ticking twice a second while
 * anything shows it, and stopped when nothing does.
 */
const clockListeners = new Set<() => void>();
let clockNow = 0;
let clockTimer: number | null = null;

function subscribeClock(onChange: () => void) {
  clockListeners.add(onChange);
  if (clockTimer === null) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      for (const l of clockListeners) l();
    }, 500);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** The time now, in milliseconds, kept current; null on the server and before the first tick. */
export function useClock(): number | null {
  return useSyncExternalStore(subscribeClock, () => (clockNow === 0 ? null : clockNow), () => null);
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the phone says it has a signal. True on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
