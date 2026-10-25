import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { type LocalDate, addDays } from "@/engine/time";
import { FREE_DAYS } from "@/lib/history/window";
import { type NoticedState, loadNoticed } from "@/lib/noticed/queries";
import { NOTICED_ACTION, NOTICED_FREE_LINE, type NoticedRow, noticedDate, noticedSource, onToday } from "@/lib/noticed/view";
import { SUMMARY_DAYS } from "@/lib/summary/summary";
import { dismissNoticed, setNoticedInSummary, setNoticedOff } from "./actions";
import { MarkNoticed } from "./mark";

type Dog = { id: string; name: string };

/** In the 90-day summary while it was made inside the summary's 90 days. */
const inSummaryReach = (row: NoticedRow, today: LocalDate) => row.computed_on > addDays(today, -SUMMARY_DAYS);

/** Marks one that is in the 90-day summary. */
export function InSummary() {
  return (
    <span className="chip chip-rec" style={{ alignSelf: "flex-start" }}>
      <Icon name="tick" size={16} />
      In the 90-day summary
    </span>
  );
}

/** Add to, or take out of, the 90-day summary, in one tap. */
export function SummaryButton({ row }: { row: NoticedRow }) {
  const added = Boolean(row.added_to_report_at);
  return (
    <form action={setNoticedInSummary}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="add" value={added ? "0" : "1"} />
      <button type="submit" className="lnk">
        {!added && <Icon name="add" />}
        {added ? "Take out of the 90-day summary" : "Add to the 90-day summary"}
      </button>
    </form>
  );
}

export function DismissButton({ row, back }: { row: NoticedRow; back?: "today" }) {
  return (
    <form action={dismissNoticed}>
      <input type="hidden" name="id" value={row.id} />
      {back && <input type="hidden" name="back" value={back} />}
      <button type="submit" className="lnk">
        Dismiss
      </button>
    </form>
  );
}

/** The latest observation on Today, for a week, until it is dismissed. Nothing when there is none. */
export async function TodayNoticed({ dog, today }: { dog: Dog; today: LocalDate }) {
  const state = await loadNoticed(dog.id, today);
  const row = state?.rows.find((r) => onToday(r, today));
  return row ? <NoticedCard dog={dog} row={row} today={today} /> : null;
}

export function NoticedCard({ dog, row, today }: { dog: Dog; row: NoticedRow; today: LocalDate }) {
  return (
    <section className="card lg stack-12" aria-label="Noticed">
      <div className="kicker">
        <span>Noticed</span>
        <span className="tn">{noticedDate(row.computed_on, today)}</span>
      </div>
      <p className="ty-lead">{row.copy}</p>
      {row.added_to_report_at && <InSummary />}
      <p className="prov">
        {noticedSource(dog.name)} {NOTICED_ACTION}
      </p>
      <div className="link-row">
        <Link className="lnk" href={`/today/noticed/${row.id}`}>
          Why am I seeing this?
          <Icon name="open" />
        </Link>
        {inSummaryReach(row, today) && <SummaryButton row={row} />}
        <DismissButton row={row} />
      </div>
      {!row.shown_at && <MarkNoticed id={row.id} seen="shown" />}
    </section>
  );
}

/**
 * Every observation the plan can see, on Trends. A free account sees those
 * its 30 days support, and is told once, plainly, that more history makes
 * them stronger. It is never told what a longer history would show.
 */
export async function TrendsNoticed({ dog, today }: { dog: Dog; today: LocalDate }) {
  const state = await loadNoticed(dog.id, today);
  return state ? <NoticedList dog={dog} state={state} today={today} /> : null;
}

export function NoticedList({ dog, state, today }: { dog: Dog; state: NoticedState; today: LocalDate }) {
  const { on, plus, rows } = state;
  return (
    <section className="card lg stack-12" aria-label="Noticed">
      <div className="kicker">
        <span>Noticed</span>
        {on && !plus && <span className="tn">Last {FREE_DAYS} days</span>}
      </div>
      {!on ? (
        <p className="prov">
          Noticed is switched off for {dog.name}. Anyone in the household can switch it on from the <Link href="/dog#noticed">Dog tab</Link>.
        </p>
      ) : rows.length === 0 ? (
        <p className="prov">
          Nothing noticed yet. Once a day Tailhelm looks at {dog.name}&rsquo;s own records, and shows at most one observation a week.
        </p>
      ) : (
        <ol className="stack-12">
          {rows.map((r, i) => (
            <li key={r.id} className="stack-4" style={i ? { borderTop: "1px solid var(--line)", paddingTop: 12 } : undefined}>
              <p className="prov tn">
                {noticedDate(r.computed_on, today)}
                {r.added_to_report_at && inSummaryReach(r, today) && " · in the 90-day summary"}
              </p>
              <p>{r.copy}</p>
              <Link className="lnk" href={`/today/noticed/${r.id}`}>
                Why am I seeing this?
                <Icon name="open" />
              </Link>
            </li>
          ))}
        </ol>
      )}
      {on && rows.length > 0 && <p className="prov">{noticedSource(dog.name)} {NOTICED_ACTION}</p>}
      {on && !plus && <p className="hint">{NOTICED_FREE_LINE}</p>}
    </section>
  );
}

/** On the Dog tab: Noticed on or off for the whole household. */
export async function NoticedSetting({ dog, today }: { dog: Dog; today: LocalDate }) {
  const state = await loadNoticed(dog.id, today);
  return state ? <NoticedSwitch dog={dog} on={state.on} /> : null;
}

export function NoticedSwitch({ dog, on }: { dog: Dog; on: boolean }) {
  return (
    <section id="noticed" className="card lg stack-16" aria-label="Noticed" style={{ maxWidth: 720 }}>
      <div className="kicker">
        <span>Noticed</span>
        <span>{on ? "On" : "Off"}</span>
      </div>
      <p className="hint">
        Once a day Tailhelm looks at {dog.name}&rsquo;s own records, and at most once a week it shows something it noticed, in numbers and
        dates. Switching it off or on applies to everyone in {dog.name}&rsquo;s household. Alerts are separate and always show.
      </p>
      <form action={setNoticedOff}>
        <input type="hidden" name="dog_id" value={dog.id} />
        <input type="hidden" name="off" value={on ? "1" : "0"} />
        <button type="submit" className="btn btn-secondary">
          {on ? "Switch Noticed off" : "Switch Noticed on"}
        </button>
      </form>
    </section>
  );
}
