import type { Range } from "@/lib/results/input";
import { type LabRow, rangeText } from "@/lib/results/rows";
import { rangeBar } from "@/lib/trends/chart";

export { type LabRow, labRows, rangeText } from "@/lib/results/rows";

const num = (n: number) => String(Number(n.toFixed(3)));

/** Inside or outside the range on the owner's own report; never a judgement of the number. */
function Reading({ value, range, sm = false }: { value: number; range: Range | null; sm?: boolean }) {
  if (!range) return <p className={sm ? "ty-sm c2" : "c2"}>No range given on your lab report</p>;
  const inside = value >= range.low && value <= range.high;
  const cls = [sm ? "ty-sm" : "", inside ? "" : "w6"].filter(Boolean).join(" ") || undefined;
  return <p className={cls}>{inside ? "Inside the range on your lab report" : "Outside the range on your lab report"}</p>;
}

function Bar({ value, range, label }: { value: number; range: Range; label: string }) {
  const bar = rangeBar(value, range);
  return (
    <div className="range" role="img" aria-label={`${label} ${num(value)}, lab report range ${num(range.low)} to ${num(range.high)}`}>
      <div className="range-track" />
      <div className="range-band" style={{ left: `${bar.band.left}%`, width: `${bar.band.width}%` }} />
      <div className="range-mark" style={{ left: `${bar.mark}%` }} />
    </div>
  );
}

function Value({ row, unitClass }: { row: LabRow; unitClass: string }) {
  return (
    <span className="tn">
      <span style={{ fontSize: 20, fontWeight: 500 }}>{row.value}</span>
      {row.unit && (
        <>
          {" "}
          <span className={unitClass}>{row.unit}</span>
        </>
      )}
    </span>
  );
}

/** The phone's list: each result over its bar, with the range's ends beneath. */
export function LabList({ rows }: { rows: LabRow[] }) {
  return (
    <div className="m-only">
      {rows.map((row, i) => {
        const value = Number(row.value);
        return (
          <div
            key={row.key}
            className="stack-8"
            style={{ padding: "16px 0", borderTop: "1px solid var(--line)", borderBottom: i === rows.length - 1 ? "1px solid var(--line)" : undefined }}
          >
            <div className="row between" style={{ alignItems: "baseline" }}>
              <span className="w6">{row.label}</span>
              <Value row={row} unitClass="c2" />
            </div>
            {row.range && (
              <div>
                <Bar value={value} range={row.range} label={row.label} />
                <div className="range-scale" aria-hidden="true">
                  <span style={{ left: "20.6%" }}>{num(row.range.low)}</span>
                  <span style={{ left: "79.4%" }}>{num(row.range.high)}</span>
                </div>
              </div>
            )}
            <Reading value={value} range={row.range} sm />
          </div>
        );
      })}
    </div>
  );
}

// Columns give way on a narrow desktop (1024px) so the table never runs past the card.
const COLS = "minmax(88px, 136px) minmax(88px, 120px) minmax(110px, 1fr) minmax(80px, 112px) minmax(120px, 280px)";

/** The desktop's table: test, result, the bar, the report's range and the reading. */
export function LabTable({ rows }: { rows: LabRow[] }) {
  return (
    <div className="d-only" role="table" aria-label="Results">
      <div role="row" className="ty-label c2" style={{ display: "grid", gridTemplateColumns: COLS, columnGap: 24, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
        <span role="columnheader">Test</span>
        <span role="columnheader" style={{ textAlign: "right" }}>
          Result
        </span>
        <span role="columnheader">Against the report&rsquo;s range</span>
        <span role="columnheader">Report range</span>
        <span role="columnheader">Reading</span>
      </div>
      {rows.map((row, i) => {
        const value = Number(row.value);
        return (
          <div
            key={row.key}
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              columnGap: 24,
              alignItems: "center",
              padding: "14px 0",
              borderBottom: i === rows.length - 1 ? undefined : "1px solid var(--line)",
            }}
          >
            <span role="cell" className="w6">
              {row.label}
            </span>
            <span role="cell" style={{ textAlign: "right" }}>
              <Value row={row} unitClass="c2 ty-sm" />
            </span>
            <span role="cell">{row.range ? <Bar value={value} range={row.range} label={row.label} /> : <span className="c2 ty-sm">No range to draw</span>}</span>
            <span role="cell" className={row.range ? "tn" : "c2"}>
              {row.range ? rangeText(row.range) : "None given"}
            </span>
            <span role="cell">
              <Reading value={value} range={row.range} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
