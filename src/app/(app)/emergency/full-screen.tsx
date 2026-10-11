"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Icon } from "@/app/_components/icon";

/** The emergency card, and a way to fill the screen with it to show someone else. */
export function FullScreenCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  return (
    <section className={full ? "stack-12 em-card is-full" : "stack-12 em-card"} aria-label="Emergency card">
      <div className="sec-h" style={{ alignItems: "center" }}>
        {title}
        {full ? (
          <button className="btn btn-secondary btn-sm em-close" type="button" onClick={() => setFull(false)}>
            <Icon name="close" size={20} />
            Close
          </button>
        ) : (
          <button className="lnk" type="button" onClick={() => setFull(true)}>
            Show full screen
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
