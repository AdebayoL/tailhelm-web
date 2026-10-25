import Link from "next/link";
import { type LocalDate, addDays } from "@/engine/time";
import { NOTICED_ACTION, type NoticedRow, noticedDate, noticedSource, recordLines, whyLines } from "@/lib/noticed/view";
import { SUMMARY_DAYS } from "@/lib/summary/summary";
import { DismissButton, InSummary, SummaryButton } from "./card";
import { MarkNoticed } from "./mark";

/** One observation, why it was shown, and the exact records behind it. */
export function NoticedDetail({ dog, row, today }: { dog: { name: string }; row: NoticedRow; today: LocalDate }) {
  const records = recordLines(row, today);
  return (
    <>
      <section className="card lg stack-12" aria-label="The observation">
        <div className="kicker">
          <span>Noticed</span>
          <span className="tn">{noticedDate(row.computed_on, today)}</span>
        </div>
        <p className="ty-lead">{row.copy}</p>
        <p className="prov">
          {noticedSource(dog.name)} {NOTICED_ACTION}
        </p>
        {row.dismissed_at ? (
          <p className="prov">Dismissed.</p>
        ) : (
          <>
            {row.added_to_report_at && <InSummary />}
            <div className="link-row">
              {row.computed_on > addDays(today, -SUMMARY_DAYS) && <SummaryButton row={row} />}
              <DismissButton row={row} back="today" />
            </div>
          </>
        )}
      </section>

      <section className="card lg stack-12" aria-label="Why am I seeing this?">
        <h2 className="r-h">Why am I seeing this?</h2>
        {whyLines(row, dog.name, today).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>

      <section className="card lg stack-12" aria-label="The records it used">
        <h2 className="r-h">The records it used</h2>
        <dl className="dl wide" style={{ rowGap: 12 }}>
          {records.map((r) => (
            <div key={r.key} style={{ display: "contents" }}>
              <dt className="tn">{r.date}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
        <p className="prov">
          Each is in <Link href="/today/past">Past days</Link> or <Link href="/trends">Trends</Link>, with who entered it.
        </p>
      </section>
      {!row.opened_at && <MarkNoticed id={row.id} seen="opened" />}
    </>
  );
}
