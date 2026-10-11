const R = 32;
const C = 2 * Math.PI * R;
const GAP = 1.6;

/**
 * The care ring: the injection cycle as one segment a day around the dog's
 * initial, with a hairline mark for each week. Days already passed fill in
 * plum and today is drawn in full contrast. It is a calendar, not a score:
 * the words beside it always state the day.
 */
export function CareRing({
  initial,
  day,
  days,
  overdue = false,
  size,
  label,
  className,
}: {
  initial: string;
  /** Today's day of the cycle, from 1. */
  day: number;
  /** Days in the cycle, as the vet set them. */
  days: number;
  /** Every day of the cycle has passed. */
  overdue?: boolean;
  size: number;
  label: string;
  className?: string;
}) {
  const seg = C / days;
  const dash = Math.max(seg - GAP, 0.5);
  const past = overdue ? days : Math.min(Math.max(day - 1, 0), days);
  const f = (n: number) => n.toFixed(3);
  const pastDash = past ? `${Array(past).fill(`${f(dash)} ${f(GAP)}`).join(" ")} 0 ${f(C)}` : `0 ${f(C)}`;
  const todayDash = overdue || day < 1 || day > days ? `0 ${f(C)}` : `0 ${f(seg * (day - 1))} ${f(dash)} ${f(C)}`;
  // A mark at the end of each full week, in the gap between two days.
  const ticks = Array.from({ length: Math.floor(days / 7) }, (_, k) => {
    const a = ((7 * (k + 1) * seg - GAP / 2) / C) * 2 * Math.PI - Math.PI / 2;
    const p = (r: number) => `${f(36 + r * Math.cos(a))} ${f(36 + r * Math.sin(a))}`;
    return `M${p(35.3)}L${p(38.3)}`;
  }).join("");
  return (
    <svg className={className ? `care-ring ${className}` : "care-ring"} viewBox="0 0 72 72" width={size} height={size} role="img" aria-label={label}>
      <g transform="rotate(-90 36 36)" fill="none" strokeWidth="4">
        <circle cx="36" cy="36" r={R} className="ring-rest" strokeDasharray={`${f(dash)} ${f(GAP)}`} />
        <circle cx="36" cy="36" r={R} className="ring-past" strokeDasharray={pastDash} />
        <circle cx="36" cy="36" r={R} className="ring-today" strokeDasharray={todayDash} />
      </g>
      {ticks && <path className="ring-ticks" d={ticks} />}
      <circle cx="36" cy="36" r="25" className="ring-core" />
      <text x="36" y="36" className="ring-initial" textAnchor="middle" dominantBaseline="central">
        {initial}
      </text>
    </svg>
  );
}
