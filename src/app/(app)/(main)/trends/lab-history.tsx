import type { LocalDate } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { formatDate } from "@/lib/plan/input";
import type { ResultType } from "@/lib/results/input";
import type { Result } from "@/lib/results/queries";
import { rangeText } from "@/lib/results/rows";
import { labChart } from "@/lib/trends/chart";

type Local = (at: string) => { date: LocalDate; time: string };

/** "Typed in by Adebayo from the printed reports", naming everyone who typed one in. */
export function typedInAll(reports: Result[], local: Local, who: (p: string | null) => string): string {
  const dates = reports.map((r) => local(r.taken_at).date).sort();
  const people = [...new Set(reports.map((r) => who(r.recorded_by)))];
  const names = people.length === 1 ? people[0] : `${people.slice(0, -1).join(", ")} and ${people[people.length - 1]}`;
  return `Reports from ${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}, typed in by ${names} from the printed reports.`;
}

/** One measure across the reports in view: a small chart of each value over its own report's range, then each value in words. */
export function LabMeasure({ field, reports, local }: { field: ResultType["fields"][number]; reports: Result[]; local: Local }) {
  const points = reports
    .filter((r) => typeof r.values_json[field.key] === "number")
    .map((r) => ({ on: local(r.taken_at).date, value: r.values_json[field.key], range: r.ranges_json?.[field.key] ?? null }));
  if (points.length === 0) return null;
  const chart = labChart(points);
  const said = chart.slots.length < points.length ? `the latest ${chart.slots.length} of ${points.length} reports` : `${points.length} reports`;
  const summary = `${field.label}, ${said}: ${points
    .slice(0, chart.slots.length)
    .map((p) => `${String(Number(p.value.toFixed(3)))} on ${dayMonth(p.on)}${p.range ? `, report range ${rangeText(p.range)}` : ", no range on the report"}`)
    .join("; ")}`;
  return (
    <div className="stack-8 lab-measure">
      <div className="row between" style={{ alignItems: "baseline", gap: 12 }}>
        <h3 className="w6">{field.label}</h3>
        <span className="prov">
          {field.unit} · {points.length} {points.length === 1 ? "report" : "reports"}
        </span>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} width="100%" role="img" aria-label={summary} style={{ display: "block", overflow: "visible", maxWidth: 420, fontFamily: "inherit" }}>
        <path className="lab-axis" d={`M${chart.x0} ${chart.axis}H${chart.x1}`} />
        {chart.slots.map((p, i) => (
          <g key={i}>
            {p.band && <rect className="lab-band" x={p.x - 12} y={p.band.y} width={24} height={p.band.height} rx={2} />}
            <circle className={p.outside ? "lab-pt out" : "lab-pt"} cx={p.x} cy={p.y} r={5} />
            <text x={p.x + 12} y={p.y + 5} style={{ fill: "var(--text)", fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {p.value}
            </text>
            {p.date && (
              <text x={p.x} y={chart.axis + 19} textAnchor="middle" style={{ fill: "var(--text-2)", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                {p.date}
              </text>
            )}
          </g>
        ))}
      </svg>
      <ul className="lab-rows">
        {[...points].reverse().map((p, i) => {
          const inside = p.range && p.value >= p.range.low && p.value <= p.range.high;
          return (
            <li key={i}>
              <span className="c2">{formatDate(p.on)}</span>
              <span>
                <b>{String(Number(p.value.toFixed(3)))}</b> <span className="c2">{field.unit}</span>
                <span className="c2">
                  {" · "}
                  {p.range ? (
                    <>
                      range {rangeText(p.range)} · <b className="w6" style={{ color: "var(--text)" }}>{inside ? "inside" : "outside"}</b>
                    </>
                  ) : (
                    "no range on the report"
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
