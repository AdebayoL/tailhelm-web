import type { LocalDate } from "@/engine/time";
import { dayMonth, monthYear } from "@/lib/app/dates";
import { type PastDay, type PastMonth, monthMeta } from "@/lib/today/past";
import { MonthDays } from "./months";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = (date: LocalDate) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

/** A month on Past days: its heading with what it holds, the latest days, and the rest a tap away. */
export function Month({ month, shown, who }: { month: PastMonth; shown: number; who: (p: string | null) => string | null }) {
  const title = monthYear(`${month.key}-01`);
  const day = (d: PastDay) => <Day key={d.date} day={d} who={who} />;
  return (
    <section className="pd-month" id={`m-${month.key}`} aria-labelledby={`h-${month.key}`}>
      <div className="month-h">
        <h2 id={`h-${month.key}`}>{title}</h2>
        <span className="meta">{monthMeta(month)}</span>
      </div>
      <div className="month-rule" aria-hidden="true" />
      <MonthDays
        shown={month.days.slice(0, shown).map(day)}
        more={month.days.slice(shown).map(day)}
        count={Math.max(0, month.days.length - shown)}
        month={title.split(" ")[0]}
      />
    </section>
  );
}

/** A day: its records in the order of the day, each with its mark, time and who recorded it. */
function Day({ day, who }: { day: PastDay; who: (p: string | null) => string | null }) {
  const name = weekday(day.date);
  return (
    <div className="pd-day" tabIndex={-1} aria-label={`${name} ${dayMonth(day.date)}`} role="group">
      <p className="pd-date" aria-hidden="true">
        <b className="m-only">{name.slice(0, 3)}</b>
        <b className="d-only">{name}</b>
        <span>{dayMonth(day.date)}</span>
      </p>
      <ul className="pd-recs">
        {day.records.map((r) => (
          <li key={r.id} className={`pd-rec ${r.mark}`}>
            <span className="k" aria-hidden="true" />
            <span className="t">{r.time ?? ""}</span>
            <span className="x">{r.text}</span>
            <span className="by">{who(r.by) ?? ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
