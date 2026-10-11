"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/app/_components/icon";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Who sees these records and when they were last current: "Shared with Sam ·
 * up to date at 17:20", or, with no signal, the time the page shows.
 */
export function SyncLine({
  shared,
  at,
  stacked = false,
  onlineOnly = false,
}: {
  shared: string;
  at: string;
  stacked?: boolean;
  /** Hidden with no signal, where the banner already says how old the page is. */
  onlineOnly?: boolean;
}) {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (offline && onlineOnly) return null;
  const lead = offline ? "No signal" : shared ? `Shared with ${shared}` : null;
  const when = offline ? `As of ${at}` : `Up to date at ${at}`;
  const text = lead ? (stacked ? null : `${lead} · ${when.charAt(0).toLowerCase()}${when.slice(1)}`) : when;
  return (
    <p className="sync" style={{ alignItems: stacked ? "flex-start" : undefined, color: offline ? "var(--warning-text)" : undefined }}>
      <Icon name={offline ? "noSignal" : "synced"} size={16} />
      {stacked && lead ? (
        <span>
          {lead}
          <br />
          {when}
        </span>
      ) : (
        <span>{text}</span>
      )}
    </p>
  );
}
