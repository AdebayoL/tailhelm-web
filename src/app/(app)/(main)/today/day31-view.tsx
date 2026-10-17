import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/app/_components/icon";
import { Mark } from "@/app/_components/mark";
import { type LocalDate, daysBetween } from "@/engine/time";
import { dayMonth, weekdayDayMonth } from "@/lib/app/dates";
import { tileLetters } from "@/lib/app/jewel";
import type { Ledger, LedgerRow } from "@/lib/plus/ledger";
import { type Day31Moment, PLUS_PRICE, outOfViewText, periodText } from "@/lib/plus/offer";
import { CountUp } from "./day31-sheet";

/** What the day-31 sheet shows, apart from loading it: its heading, the ledger, the words and the price. */

export function Day31Head({ labelId, dogName, from, today }: { labelId: string; dogName: string; from: LocalDate; today: LocalDate }) {
  return (
    <header className="d31-head">
      <div>
        <p className="d31-mark">
          <span className="plus-mark">
            <Mark size={18} />
            {dogName}
          </span>
          <span className="m-only">{periodText(from, today)}</span>
        </p>
        <h2 id={labelId} className="d31-title" tabIndex={-1}>
          A month of {dogName}&rsquo;s care, since {dayMonth(from)}
        </h2>
      </div>
      <p className="d31-mark d-only">
        {periodText(from, today)} · {weekdayDayMonth(today)}
      </p>
    </header>
  );
}

/** What moves out of view and stays kept, what stays free, and for the owner alone, the price. */
export function Day31Words({
  moment,
  dogName,
  owner,
  ownerName,
  preview,
  children,
}: {
  moment: Day31Moment;
  dogName: string;
  owner: boolean;
  ownerName: string | null;
  preview: boolean;
  /** The buttons. */
  children: ReactNode;
}) {
  return (
    <div className="d31-right">
      <div className="d31-words">
        <p>{outOfViewText(moment)}</p>
        <p className="prov">
          Reminders, the emergency card, crisis alerts, the household and the 90-day summary for your vet stay free on every plan.
        </p>
        <p>Plus keeps the whole story on screen for as long as the account exists, with trends across months and the designed vet report.</p>
      </div>
      {owner ? (
        <div className="d31-offer">
          <p className="pricebox">
            <span className="fig">£{PLUS_PRICE.year}</span>
            <span className="alt">a year</span>
            <span className="alt">· or £{PLUS_PRICE.month} a month</span>
          </p>
          <p className="terms">UK only, prices include VAT. Full refund within 30 days. Renews each year unless you turn renewal off.</p>
        </div>
      ) : (
        <div className="d31-member">
          <p>
            {ownerName ?? "The account owner"} looks after {dogName}&rsquo;s plan
          </p>
          <p className="prov">Billing is only shown to the account owner.</p>
        </div>
      )}
      {preview && (
        <p className="d31-preview" role="note">
          This is a preview. Payments are not open yet, so Choose Plus does nothing, and closing this keeps it available here.
        </p>
      )}
      {children}
    </div>
  );
}

/** The tiles shown while the figures load: each medicine on the plan, then checks, measurements and notes. */
export function loadingRows(medicines: { name: string; mark: "pred" | "zyc" }[]): Pick<LedgerRow, "mark" | "tile">[] {
  return [
    ...medicines.map((m) => ({ mark: m.mark, tile: tileLetters(m.name) })),
    { mark: "chk", tile: null },
    { mark: "meas", tile: null },
    { mark: "note", tile: null },
  ];
}

function LedgerHead({ from, to, days }: { from: LocalDate; to: LocalDate; days: number }) {
  return (
    <div className="ledger-h" aria-hidden="true">
      <span>
        <b>{periodText(from, to)}</b> · {days} days
      </span>
      <span>Recorded by</span>
    </div>
  );
}

function Tile({ row }: { row: Pick<LedgerRow, "mark" | "tile"> }) {
  return (
    <span className={`med ${row.mark}`} aria-hidden="true">
      {row.tile ?? <Icon name={row.mark === "chk" ? "check" : row.mark === "note" ? "note" : "trends"} />}
    </span>
  );
}

export function LedgerTable({ ledger }: { ledger: Ledger }) {
  return (
    <section className="ledger" aria-label={`What your household recorded, ${periodText(ledger.from, ledger.to)}`}>
      <LedgerHead from={ledger.from} to={ledger.to} days={ledger.days} />
      <ul className="ledger-rows">
        {ledger.rows.map((row, i) => (
          <li key={row.key} className="ledger-row">
            <span className="sr">{row.sentence}</span>
            <Tile row={row} />
            <span className="lg-n settle" style={{ "--i": i } as CSSProperties} aria-hidden="true">
              <CountUp value={row.count} index={i} />
            </span>
            <span aria-hidden="true">
              <span className="lg-l">{row.label}</span>
              <span className="lg-s">{row.sub}</span>
            </span>
            <span className="lg-who" aria-hidden="true">
              {row.who.map((p) => (
                <span key={p.id} className={`who ${p.tone}`} title={p.name}>
                  {p.initial}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="ledger-f">
        <span>
          <b>{ledger.total}</b> {ledger.total === 1 ? "record" : "records"}, kept
        </span>
        <span>Nothing is ever deleted</span>
      </p>
    </section>
  );
}

/** While the figures load: the heading and both buttons are already there, and each row is a quiet bar. */
export function LedgerLoading({ from, today, rows }: { from: LocalDate; today: LocalDate; rows: Pick<LedgerRow, "mark" | "tile">[] }) {
  return (
    <section className="ledger" aria-busy="true" aria-label="Loading what your household recorded">
      <LedgerHead from={from} to={today} days={daysBetween(from, today) + 1} />
      <ul className="ledger-rows" aria-hidden="true">
        {rows.map((row, i) => (
          <li key={i} className="ledger-row">
            <Tile row={row} />
            <span className="sk n" />
            <span>
              <span className="sk l" />
              <span className="sk s" />
            </span>
            <span className="lg-who">
              <span className="sk w" />
            </span>
          </li>
        ))}
      </ul>
      <p className="ledger-f" aria-hidden="true">
        <span className="sk l" style={{ width: 120 }} />
        <span>Nothing is ever deleted</span>
      </p>
    </section>
  );
}
