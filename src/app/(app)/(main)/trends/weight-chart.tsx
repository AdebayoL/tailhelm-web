import type { Frame, WeightChart as Chart } from "@/lib/trends/chart";

const grid = { stroke: "var(--line)", strokeWidth: 1 };
const axis = { stroke: "var(--line-control)", strokeWidth: 1 };
const label = { fill: "var(--text-2)", fontSize: 14 };

/**
 * The weight chart as the design draws it: clinic weights joined, home weights
 * as lone diamonds, and on a desktop the injection days as dashed lines with
 * the latest clinic weight labelled.
 */
export function WeightChart({ chart, frame, desk, summary }: { chart: Chart; frame: Frame; desk: boolean; summary: string }) {
  const r = desk ? 5 : 4.5;
  const d = desk ? 7 : 6;
  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      width="100%"
      role="img"
      aria-label={summary}
      className="wt-chart"
      style={{ display: "block", overflow: "visible", fontFamily: "inherit", maxWidth: desk ? undefined : 420 }}
    >
      <path style={grid} d={chart.gridlines.map((g) => `M${frame.x0 - 0.5} ${Math.floor(g.y) + 0.5}H${frame.x1}`).join("")} />
      {desk && chart.marks.length > 0 && (
        <path
          style={{ ...axis, strokeDasharray: "3 4" }}
          d={chart.marks.map((x) => `M${x} ${frame.yTop}V${frame.axis - 0.5}`).join("")}
        />
      )}
      <path style={axis} d={`M${frame.x0 - 0.5} ${frame.axis}H${frame.x1}`} />
      <path style={axis} d={chart.xTicks.map((t) => `M${t.x} ${frame.axis}v${desk ? 5 : 4}`).join("")} />
      <g style={{ ...label, fontVariantNumeric: "tabular-nums" }} textAnchor="end">
        {chart.gridlines.map((g) => (
          <text key={g.label} x={frame.yLabelX} y={g.y + 4.5}>
            {g.label}
          </text>
        ))}
      </g>
      <g style={label} textAnchor="middle">
        {chart.xTicks.map((t) => (
          <text key={`${t.x}-${t.label}`} x={t.x} y={frame.xLabelY}>
            {t.label}
          </text>
        ))}
      </g>
      {chart.line && (
        <path
          d={chart.line}
          style={{ fill: "none", stroke: "var(--chart-line)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }}
        />
      )}
      <g style={{ fill: "var(--chart-line)", stroke: "var(--surface)", strokeWidth: 2 }}>
        {chart.dots.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={r} />
        ))}
      </g>
      <g style={{ fill: "var(--surface)", stroke: "var(--chart-line)", strokeWidth: 2, strokeLinejoin: "round" }}>
        {chart.diamonds.map((p, i) => (
          <path key={i} d={`M${p.x} ${p.y - d}L${p.x + d} ${p.y}L${p.x} ${p.y + d}L${p.x - d} ${p.y}Z`} />
        ))}
      </g>
      {desk && chart.latest && (
        <text
          x={chart.latest.x}
          y={chart.latest.y - 14}
          textAnchor="middle"
          style={{ fill: "var(--text)", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
        >
          {chart.latest.label}
        </text>
      )}
    </svg>
  );
}

export function ClinicKey({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r={size === 12 ? 4.5 : 5} style={{ fill: "var(--chart-line)" }} />
    </svg>
  );
}

export function HomeKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1.5L12.5 7L7 12.5L1.5 7Z"
        style={{ fill: "var(--surface)", stroke: "var(--chart-line)", strokeWidth: 2, strokeLinejoin: "round" }}
      />
    </svg>
  );
}

export function InjectionKey() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 0V14" style={{ stroke: "var(--line-control)", strokeWidth: 1.5, strokeDasharray: "3 3" }} />
    </svg>
  );
}
