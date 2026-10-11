import type { CSSProperties } from "react";

/**
 * The Tailhelm symbol: a capital T drawn as a scent hound's head, the stem a
 * long folded ear cut from the head. At 48 px and above it uses the hairline
 * cut; at 32 px and below a heavier cut keeps the ear separate on a small
 * screen. The home-screen icons in public/icons are drawn from the same paths.
 */
export const MARK_LARGE =
  "M14.1 10H14A6 6 0 0 0 14 22H14.1ZM26.7 10H27C31.5 10 35.5 11.2 38.6 13.4C39.9 14.3 40.5 15.6 40.5 17.1V18.5A3.5 3.5 0 0 1 37 22H26.7ZM15.4 10H25.4V22C25.4 26 25.9 29 25.9 32.2C25.9 37.2 23.4 40.9 20.4 40.9C17.4 40.9 14.9 37.2 14.9 32.2C14.9 29 15.4 26 15.4 22Z";
export const MARK_SMALL =
  "M13.6 10H14A6 6 0 0 0 14 22H13.6ZM27.2 10C31.6 10 35.5 11.2 38.6 13.4C39.9 14.3 40.5 15.6 40.5 17.1V18.5A3.5 3.5 0 0 1 37 22H27.2ZM15.4 10H25.4V22C25.4 26 25.9 29 25.9 32.2C25.9 37.2 23.4 40.9 20.4 40.9C17.4 40.9 14.9 37.2 14.9 32.2C14.9 29 15.4 26 15.4 22Z";

export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="mark" viewBox="0 0 48 48" style={{ width: size, height: size }} aria-hidden="true" focusable="false">
      {/* Shifted to its optical centre, so the ear's weight sits on the vertical axis. */}
      <path transform="translate(.6 -1.4)" d={size >= 48 ? MARK_LARGE : MARK_SMALL} />
    </svg>
  );
}

/** The symbol and the name together, in navy (pale on night). */
export function Wordmark({ size = 30, textStyle }: { size?: number; textStyle?: CSSProperties }) {
  return (
    <>
      <Mark size={size} />
      <span className="wm-text" style={textStyle}>
        Tailhelm
      </span>
    </>
  );
}
