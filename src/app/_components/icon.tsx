import type { ReactNode } from "react";

/**
 * The design system's icons: a 24 px grid, a 1.75 px stroke at every size,
 * round caps and joins. Always beside a word, so they are hidden from screen
 * readers.
 */
const PATHS = {
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  boxTick: <path d="M5.5 12.5l4 4L18.5 7.5" />,
  recorded: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 12.3l2.8 2.8 5.2-5.4" />
    </>
  ),
  due: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l7 12.1a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.6h.01" />
    </>
  ),
  attention: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5" />
      <path d="M12 16h.01" />
    </>
  ),
  asOf: <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3.2" />,
  localTick: (
    <>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3.2" />
      <path d="M8.5 12.3l2.4 2.4 4.6-4.8" />
    </>
  ),
  thisPhone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17.5h2" />
    </>
  ),
  thisComputer: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </>
  ),
  noSignal: (
    <>
      <path d="M3.5 3.5l17 17" />
      <path d="M8.6 15.6a5 5 0 0 1 6.5-.3" />
      <path d="M5.3 12.3a9.7 9.7 0 0 1 4.3-2.3" />
      <path d="M14.6 9.9a9.7 9.7 0 0 1 4.1 2.4" />
      <path d="M2.5 9.1a14.4 14.4 0 0 1 3.9-2.6" />
      <path d="M10.6 5.4A14.4 14.4 0 0 1 21.5 9.1" />
      <path d="M12 19.3h.01" />
    </>
  ),
  synced: (
    <>
      <path d="M19.5 10.5A7.7 7.7 0 0 0 5.9 7.4L4.5 9" />
      <path d="M4.5 4.5V9H9" />
      <path d="M4.5 13.5a7.7 7.7 0 0 0 13.6 3.1l1.4-1.6" />
      <path d="M19.5 19.5V15H15" />
    </>
  ),
  call: <path d="M8.6 4H6.3A2 2 0 0 0 4.3 6.2C5 13.9 10.1 19 17.8 19.7A2 2 0 0 0 20 17.7v-2.3l-4-1.6-2 2a12.5 12.5 0 0 1-6.3-6.3l2-2z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  reminder: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  today: (
    <>
      <path d="M10.5 7h9.5M10.5 12h9.5M10.5 17h9.5" />
      <path d="M4 7.2l1.4 1.4L8 6M4 12.2l1.4 1.4L8 11" />
      <circle cx="6" cy="17" r="1.6" />
    </>
  ),
  trends: (
    <>
      <path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" />
      <path d="M7.5 15l3.5-4.5 3 2.5 4.5-6" />
    </>
  ),
  careTeam: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.75" cy="9.5" r="2.5" />
      <path d="M15.6 14.4a4.6 4.6 0 0 1 4.9 5.1" />
    </>
  ),
  vetVisit: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3.5h6v2.5H9z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  invitation: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  invite: (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M19 8.5v6M16 11.5h6" />
    </>
  ),
  sendReport: (
    <>
      <path d="M20.5 3.5L10.2 13.8" />
      <path d="M20.5 3.5l-6.3 17-4-6.7-6.7-4z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4.2L19 9.2 14.8 5 4 15.8z" />
      <path d="M13 6.8l4.2 4.2" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  /** The Share button in Safari and Chrome on iPhone. */
  share: (
    <>
      <path d="M12 3.5v11M8 7l4-3.5L16 7" />
      <path d="M8.5 10.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5" />
    </>
  ),
  /** Add to Home Screen in the iPhone's share sheet. */
  addSquare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  open: <path d="M9.5 6l6 6-6 6" />,
  back: <path d="M14.5 6l-6 6 6 6" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS | "dog";

const SIZE: Record<number, string> = { 16: "ic-16", 20: "ic-20", 24: "", 28: "ic-28", 32: "ic-32" };

export function Icon({ name, size = 24, className = "" }: { name: IconName; size?: 16 | 20 | 24 | 28 | 32; className?: string }) {
  const classes = ["ic", SIZE[size], name === "recorded" ? "tickc" : "", className].filter(Boolean).join(" ");
  if (name === "dog") {
    // The symbol in outline, for the Dog tab: the ear filled to sit on the bar.
    return (
      <svg className={classes} viewBox="0 0 48 48" style={{ strokeWidth: 3.5 }} aria-hidden="true" focusable="false">
        <g transform="translate(.6 -1.4)">
          <path d="M14 10H27C31.5 10 35.5 11.2 38.6 13.4C39.9 14.3 40.5 15.6 40.5 17.1V18.5A3.5 3.5 0 0 1 37 22H14A6 6 0 0 1 14 10Z" />
          <path className="ear" d="M15.4 10H25.4V22C25.4 26 25.9 29 25.9 32.2C25.9 37.2 23.4 40.9 20.4 40.9C17.4 40.9 14.9 37.2 14.9 32.2C14.9 29 15.4 26 15.4 22Z" />
        </g>
      </svg>
    );
  }
  return (
    <svg className={classes} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
