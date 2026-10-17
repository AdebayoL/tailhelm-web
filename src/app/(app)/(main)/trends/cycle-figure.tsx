"use client";

import { type ReactNode, useState } from "react";

/**
 * The weight chart's figure, with a switch for the injection days drawn over
 * it. They show to begin with; turning them off hides only the lines.
 */
export function CycleFigure({ cycle, children }: { cycle: boolean; children: ReactNode }) {
  const [on, setOn] = useState(true);
  return (
    <figure className="stack-8 wt-fig" data-cycle={on ? "on" : "off"}>
      {children}
      {cycle && (
        <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => setOn(!on)}>
          <span className="sw" aria-hidden="true" />
          Show the injection cycle
        </button>
      )}
    </figure>
  );
}
