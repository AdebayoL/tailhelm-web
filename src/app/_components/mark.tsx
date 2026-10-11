/**
 * The Tailhelm hound. Decorative wherever it sits next to the name; the
 * home-screen icons in public/icons are drawn from the same shape.
 */
export function HoundMark({
  size = 28,
  body = "var(--green)",
  ear = "var(--rule-strong)",
  eye = "var(--paper)",
}: {
  size?: number;
  body?: string;
  ear?: string;
  eye?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        d="M14 16C17 11 25 10 29 13C31 15 32 17 34 18L41 19.5C43.5 20 44 23.5 41.5 24.5L35 27C33 31 30 33 27 34L26 42H13C11 34 11 22 14 16Z"
        fill={body}
      />
      <path d="M17 15C12 17 11 27 14 33C17 32 19 26 20 18C19.5 16 18.5 15 17 15Z" fill={ear} />
      <circle cx="28.5" cy="18" r="1.4" fill={eye} />
    </svg>
  );
}

/** The mark and the name together, as on the header. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <HoundMark size={size} />
      <span className="text-[1.375rem] font-bold tracking-tight text-green">Tailhelm</span>
    </span>
  );
}
