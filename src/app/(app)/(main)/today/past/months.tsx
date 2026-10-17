"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "@/app/_components/icon";

export type MonthLink = { key: string; short: string; long: string; year: string; count: string };

/**
 * The months to move between: a strip of pills on a phone, a rail beside the
 * days on a desktop. Each is a plain link to its month; the month on screen
 * is marked as it scrolls past.
 */
export function MonthNav({ months, variant, hint }: { months: MonthLink[]; variant: "strip" | "rail"; hint?: ReactNode }) {
  const [current, setCurrent] = useState(months[0]?.key ?? null);
  useEffect(() => {
    const sections = months.map((m) => document.getElementById(`m-${m.key}`)).filter((s): s is HTMLElement => s !== null);
    if (sections.length < 2 || !("IntersectionObserver" in window)) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = e.target.id.slice(2);
          if (e.isIntersecting) seen.add(key);
          else seen.delete(key);
        }
        // The newest month still on screen is the one being read.
        const first = months.find((m) => seen.has(m.key));
        if (first) setCurrent(first.key);
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, [months]);

  if (variant === "strip") {
    // A year follows its months only when the strip crosses into another year.
    const years = new Set(months.map((m) => m.year)).size > 1;
    return (
      <nav className="mstrip" aria-label="Months">
        {months.map((m, i) => (
          <MonthAnchor key={m.key} month={m} on={m.key === current} after={years && months[i + 1]?.year !== m.year ? m.year : null}>
            {m.short}
          </MonthAnchor>
        ))}
      </nav>
    );
  }
  return (
    <nav className="mrail" aria-label="Months">
      {months.map((m, i) => (
        <div key={m.key} style={{ display: "contents" }}>
          {months[i - 1]?.year !== m.year && <p className="yr">{m.year}</p>}
          <a href={`#m-${m.key}`} className={m.key === current ? "on" : undefined} aria-current={m.key === current ? "location" : undefined}>
            <span>{m.long}</span>
            <span className="n">{m.count}</span>
          </a>
        </div>
      ))}
      {hint}
    </nav>
  );
}

function MonthAnchor({ month, on, after, children }: { month: MonthLink; on: boolean; after: string | null; children: ReactNode }) {
  return (
    <>
      <a href={`#m-${month.key}`} className={on ? "on" : undefined} aria-current={on ? "location" : undefined} aria-label={`${month.long} ${month.year}`}>
        {children}
      </a>
      {after && (
        <span className="yr" aria-hidden="true">
          {after}
        </span>
      )}
    </>
  );
}

/**
 * A month's days: the latest few, then the rest behind "13 more days in
 * October". The rest are already in the page, so opening them is instant,
 * and focus moves to the first day it reveals.
 */
export function MonthDays({ shown, more, count, month }: { shown: ReactNode; more: ReactNode; count: number; month: string }) {
  const [open, setOpen] = useState(false);
  const rest = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) rest.current?.querySelector<HTMLElement>(".pd-day")?.focus();
  }, [open]);
  return (
    <>
      <div className="card pd-days">
        {shown}
        {count > 0 && (
          <div className="pd-more" ref={rest} hidden={!open}>
            {more}
          </div>
        )}
      </div>
      {count > 0 && !open && (
        <button type="button" className="lnk pd-more-btn" onClick={() => setOpen(true)}>
          {count} more {count === 1 ? "day" : "days"} in {month}
          <Icon name="open" size={20} />
        </button>
      )}
    </>
  );
}
