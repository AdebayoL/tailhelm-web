"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * The design's sheet: rises from the foot of a phone, and sits as a centred
 * dialog on a desktop. Escape or the scrim closes it, unless it is asking
 * something that needs an answer.
 */
export function Sheet({
  label,
  onClose,
  alert = false,
  children,
}: {
  label: string;
  onClose: () => void;
  /** An alertdialog, such as the double-dose guard. */
  alert?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="overlay">
      <div className="scrim" onClick={() => close.current()} />
      <section ref={ref} className="sheet stack-16" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="grabber" style={{ marginBottom: 4 }} />
        {children}
      </section>
    </div>,
    document.body,
  );
}
