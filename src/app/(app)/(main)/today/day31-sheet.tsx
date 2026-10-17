"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { markDay31Seen } from "./actions";

const noSubscription = () => () => {};

/** Closes the sheet, and unless it is a preview, never shows it to this person again. */
const CloseSheet = createContext<() => void>(() => {});

/**
 * The day-31 sheet: a modal dialog over Today on a phone, a centred panel on
 * a desktop. Focus moves to the heading once it is open and returns to where
 * it was when it closes; Escape is the same as "Not now". The scrim does not
 * close it, so a stray tap never dismisses it for good.
 */
export function Day31Sheet({ dogId, labelId, record, children }: { dogId: string; labelId: string; record: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  // The portal needs the page's body, so the sheet appears once the page is in the browser.
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const close = useCallback(() => {
    setOpen(false);
    if (record) void markDay31Seen(dogId);
  }, [record, dogId]);

  useEffect(() => {
    if (!open || !inBrowser) return;
    const opener = document.activeElement as HTMLElement | null;
    document.getElementById(labelId)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, inBrowser, labelId, close]);

  if (!open || !inBrowser) return null;
  return createPortal(
    <div className="overlay">
      <div className="scrim d31-scrim" />
      <section className="d31" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="grabber" />
        <CloseSheet.Provider value={close}>
          <div className="d31-body">{children}</div>
        </CloseSheet.Provider>
      </section>
    </div>,
    document.body,
  );
}

/**
 * The sheet's two buttons, the same size: "Choose Plus" and "Not now" for the
 * owner, or "Close" for everyone else. Choose Plus waits for the figures, and
 * stays off until there is a checkout to open; Not now always works.
 */
export function Day31Actions({ owner, choose, loading = false }: { owner: boolean; choose: string | null; loading?: boolean }) {
  const close = useContext(CloseSheet);
  if (!owner) {
    return (
      <div className="d31-actions">
        <button type="button" className="btn btn-primary" onClick={close}>
          Close
        </button>
      </div>
    );
  }
  return (
    <div className="d31-actions">
      {choose && !loading ? (
        <a className="btn btn-primary" href={choose} onClick={close}>
          Choose Plus
        </a>
      ) : (
        <button type="button" className="btn btn-primary" disabled>
          Choose Plus
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={close}>
        Not now
      </button>
    </div>
  );
}

/**
 * A ledger figure that rises from 0 to its value as the sheet settles, in
 * tabular figures so nothing shifts. The value is in the page from the start,
 * and stays put when the owner has asked for less motion.
 */
export function CountUp({ value, index }: { value: number; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.textContent = "0";
    const start = performance.now() + index * 40;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / 480));
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = String(value);
    };
  }, [value, index]);
  return <span ref={ref}>{value}</span>;
}
