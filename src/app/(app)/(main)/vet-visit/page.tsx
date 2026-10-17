import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { type LocalDate, addDays, toLocal } from "@/engine/time";
import { dayMonth, monthYear, weekdayDate } from "@/lib/app/dates";
import { jewelClass } from "@/lib/app/jewel";
import { getShell } from "@/lib/app/shell";
import { requireSetup } from "@/lib/setup/queries";
import { joinNames } from "@/lib/app/words";
import { telHref } from "@/lib/dogs/input";
import type { Dog } from "@/lib/dogs/queries";
import { getNotes } from "@/lib/notes/queries";
import { doseText, formatDate, planLine } from "@/lib/plan/input";
import type { PlanItem } from "@/lib/plan/queries";
import { type ResultType, resultTypes } from "@/lib/results/input";
import { type Result, getResults } from "@/lib/results/queries";
import { signsType } from "@/lib/signs/signs";
import { getTodayData } from "@/lib/today/queries";
import { buildToday } from "@/lib/today/today";
import {
  checkGrid,
  daysAgoText,
  doseStatus,
  nextDueText,
} from "@/lib/vetvisit/summary";
import { WEIGHT_TYPE, kgFigure } from "@/lib/weight/input";
import { conditionMedicalName, conditionName } from "@/packs/names";
import { getPack } from "@/packs/registry";
import { Page } from "../../_components/page";
import { type LabRow, labRows, rangeText } from "../trends/lab-report";

export const metadata: Metadata = { title: "Vet visit · Tailhelm" };

/**
 * One screen to hand to a vet standing next to the dog: the condition, the
 * plan as the vet set it, the last injection, today's doses, the latest
 * results, weight and the last 7 days of checks. Every line says who
 * recorded it and when.
 */
export default function VetVisitPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <VetVisit />
    </Suspense>
  );
}

const STATUS_ICON = { given: "recorded", due: "due", late: "alert" } as const;
const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekday(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

async function VetVisit() {
  await requireSetup();
  const [data, shell] = await Promise.all([getTodayData(), getShell()]);
  if (!data?.plan) {
    return (
      <Page title="Vet visit">
        <section className="card lg stack-16" aria-label="Nothing to show yet">
          <h2 className="r-t">Nothing to show your vet yet</h2>
          <p>
            Add your dog and their care plan, and this page gathers what the
            household records for your vet.
          </p>
          <Link
            href="/dog"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start", width: "auto" }}
          >
            Go to Dog
          </Link>
        </section>
      </Page>
    );
  }

  const { dog, plan, input } = data;
  const today = buildToday(input);
  const pack = getPack(plan.condition.condition_key);
  const types = resultTypes(pack);
  const signs = signsType(pack);
  const weekAgo = addDays(today.date, -6);
  const [results, weights, checks, notes] = await Promise.all([
    getResults(
      plan.condition.id,
      types.map((t) => t.key),
      20,
    ),
    getResults(plan.condition.id, [WEIGHT_TYPE], 20),
    signs
      ? getResults(plan.condition.id, [signs.key], 60)
      : Promise.resolve([]),
    getNotes(dog.id, 20),
  ]);
  const local = (at: string) => toLocal(new Date(at), input.timeZone);
  const who = (profile: string | null) =>
    (profile && input.names[profile]) || "someone in the household";
  const now = toLocal(input.now, input.timeZone);
  const prepared = `${weekdayDate(now.date)}, ${now.time}`;
  const facts = [
    dog.name,
    dog.breed,
    dog.date_of_birth && `born ${monthYear(dog.date_of_birth)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const condition = plan.condition;
  const medical = conditionMedicalName(condition.condition_key);
  const rank = {
    fixed: 0,
    interval: 1,
    offset: 2,
    series: 3,
    event: 4,
  } as const;
  const items = [...plan.items].sort(
    (a, b) => rank[a.schedule_json.kind] - rank[b.schedule_json.kind],
  );
  const enteredBy = joinNames([
    ...new Set(items.map((i) => who(i.created_by))),
  ]);
  const week = checks.filter((c) => local(c.taken_at).date >= weekAgo);
  const weekNotes = notes
    .filter((n) => local(n.started_at).date >= weekAgo)
    .slice(0, 5);
  const latest = types
    .map((type) => ({
      type,
      report: results.find((r) => r.type_key === type.key),
    }))
    .filter((r): r is { type: ResultType; report: Result } => !!r.report);
  const grid =
    signs && checkGrid(week, signs.signs, today.date, input.timeZone);

  return (
    <Page
      title="Vet visit"
      space={24}
      sub={
        <>
          <span className="d-only">
            {facts} · prepared {prepared}
          </span>
          <span className="m-only">
            <span
              className="ty-lead"
              style={{ display: "block", color: "var(--text)" }}
            >
              {facts}
            </span>
            <span className="prov" style={{ display: "block" }}>
              Prepared {prepared} · synced {shell.at}
            </span>
          </span>
        </>
      }
    >
      <div className="vv">
        <section className="panel vv-key" aria-label="How to read this page">
          <dl className="dl wide m-only" style={{ rowGap: 4 }}>
            {KEY.map(([term, meaning]) => (
              <Fragment key={term}>
                <dt>{term}</dt>
                <dd className="ty-sm">{meaning}</dd>
              </Fragment>
            ))}
          </dl>
          {KEY.map(([term, meaning]) => (
            <p key={term} className="ty-sm d-only">
              <b className="w6">{term}</b> <span className="c2">{meaning}</span>
            </p>
          ))}
        </section>

        <div className="d-row">
          <section
            className="card lg stack-8"
            aria-label="Condition"
            style={{ flex: "1 1 300px" }}
          >
            <div className="kicker">
              <span>Condition</span>
            </div>
            <p className="ty-title m-only">
              {conditionName(condition.condition_key)}
              {medical && (
                <span className="c2" style={{ fontWeight: 400 }}>
                  {" "}
                  ({medical})
                </span>
              )}
            </p>
            <div className="d-only stack-8">
              <p className="d-h">{conditionName(condition.condition_key)}</p>
              {medical && <p className="c2">({medical})</p>}
            </div>
            {condition.diagnosed_on && (
              <p className="prov" style={{ marginTop: "auto" }}>
                Diagnosed {formatDate(condition.diagnosed_on)}
              </p>
            )}
          </section>

          {today.countdowns.map((c) => {
            const last = data.injections[c.item.id]?.last;
            const due = nextDueText(c);
            return (
              <section
                key={c.item.id}
                className="card lg stack-8"
                aria-label="Last treatment"
                style={{ flex: "1 1 300px" }}
              >
                <div className="kicker">
                  <span>Last treatment</span>
                  <span className={jewelClass(c.item.schedule_json)}>{c.item.product}</span>
                </div>
                {last ? (
                  <>
                    <p className="figline">
                      <span className="r-fig-md">
                        {dayMonth(last.given_on)}
                      </span>
                      <span className="unit">{last.given_on.slice(0, 4)}</span>
                    </p>
                    <p className="prov" style={{ marginTop: "auto" }}>
                      {daysAgoText(last.given_on, today.date)} · recorded by{" "}
                      {last.given_by ?? who(last.given_by_profile)}
                      {due && (
                        <>
                          {" "}
                          · {due.text}
                          {due.date && (
                            <span className="m-only">, {due.date}</span>
                          )}
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="r-t">None recorded yet</p>
                )}
              </section>
            );
          })}

          <WeightCard weights={weights} local={local} who={who} />
        </div>

        <div className="d-row">
          <section
            className="card lg stack-12"
            aria-label="Care plan"
            style={{ flex: "1 1 440px" }}
          >
            <div className="kicker">
              <span>Care plan, as entered from your instructions</span>
            </div>
            {items.length === 0 ? (
              <p>Nothing on the plan yet.</p>
            ) : (
              <ul className="vv-plan">
                {items.map((item) => {
                  const line = planLine(item);
                  return (
                    <li key={item.id} className="tn">
                      <b className={`w6 ${jewelClass(item.schedule_json)}`}>{line.name}</b> {line.rest}
                      {line.set && (
                        <>
                          {" "}
                          <span className="c2 nowrap">{line.set}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {today.events.length > 0 && (
              <p className="prov">
                Stressful events planned:{" "}
                {today.events
                  .map(
                    (e) =>
                      `${e.title}, ${dayMonth(e.startsOn)}${e.endsOn && e.endsOn !== e.startsOn ? ` to ${dayMonth(e.endsOn)}` : ""}`,
                  )
                  .join("; ")}
              </p>
            )}
            {items.length > 0 && (
              <p className="prov" style={{ marginTop: "auto" }}>
                Entered by {enteredBy}
              </p>
            )}
          </section>

          <section
            className="card lg vv-doses"
            aria-label="Today's doses"
            style={{ flex: "1 1 440px" }}
          >
            <div className="kicker">
              <span>Today&rsquo;s doses</span>
              <span className="tn">{dayMonthWeekday(today.date)}</span>
            </div>
            {today.doses.length === 0 ? (
              <p className="vv-none">No doses on the plan today.</p>
            ) : (
              <ol>
                {today.doses.map((d) => {
                  const item = items.find(
                    (i) => i.id === d.item.id,
                  ) as PlanItem;
                  const status = doseStatus(d);
                  const amount = doseText(item);
                  return (
                    <li key={`${d.item.id}-${d.slot}`} className="rec vv-dose">
                      <span className="rec-time">{d.slot}</span>
                      <div className="vv-dose-what">
                        <p className="rec-med">
                          <b className={jewelClass(item.schedule_json)}>{planLine(item).name}</b>
                          {amount && ` ${amount}`}
                        </p>
                        <p
                          className={
                            status.kind === "due" ? "st" : `st ${status.kind}`
                          }
                        >
                          <Icon name={STATUS_ICON[status.kind]} />
                          <span>
                            {status.text}
                            {status.extras.map((x) => (
                              <span key={x} className="block">
                                {x}
                              </span>
                            ))}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="d-row">
          {latest.length === 0 ? (
            <section
              className="card lg stack-12"
              aria-label="Latest results"
              style={{ flex: "1 1 440px" }}
            >
              <div className="kicker">
                <span className="m-meas">Latest results</span>
              </div>
              <p>No lab reports recorded yet.</p>
            </section>
          ) : (
            latest.map(({ type, report }) => (
              <ResultsCard
                key={type.key}
                rows={labRows(type, report, pack)}
                report={report}
                local={local}
                who={who}
              />
            ))
          )}

          {signs && grid && (
            <section
              className="card lg stack-12"
              aria-label="Last 7 days of checks"
              style={{ flex: "1 1 440px" }}
            >
              <div className="kicker">
                <span>Last 7 days of checks</span>
                <span className="tn">
                  {spanText(grid.days[0], grid.days[6])}
                </span>
              </div>
              <div role="table" aria-label={`${signs.name}, last 7 days`}>
                <div role="row" className="vv-grid vv-days">
                  <span role="columnheader" />
                  {grid.days.map((date, i) => (
                    <span
                      key={date}
                      role="columnheader"
                      className={i === 6 ? "w6" : "c2"}
                    >
                      <span className="m-only">
                        {DAYS_SHORT[weekday(date)]}
                      </span>
                      <span className="d-only">{DAYS[weekday(date)]}</span>
                      <br />
                      {Number(date.slice(8))}
                    </span>
                  ))}
                </div>
                <div className="vv-grid vv-marks">
                  {grid.rows.map((row) => (
                    <div
                      key={row.sign.key}
                      role="row"
                      style={{ display: "contents" }}
                    >
                      <span role="rowheader" className="vv-sign">
                        {row.sign.label}
                      </span>
                      {row.marks.map((mark, i) =>
                        mark === "ticked" ? (
                          <span
                            key={i}
                            role="cell"
                            aria-label="ticked"
                            style={{
                              color: "var(--recorded)",
                              display: "inline-flex",
                            }}
                          >
                            <Icon name="tick" size={16} />
                          </span>
                        ) : mark === "not-ticked" ? (
                          <span
                            key={i}
                            role="cell"
                            className="c2"
                            aria-label="not ticked"
                          >
                            –
                          </span>
                        ) : (
                          <span key={i} role="cell" aria-label="no check" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="prov">
                Tick: noticed and ticked. Dash: not ticked. Blank: no check
                recorded that day. Today&rsquo;s column is so far.
              </p>
              {weekNotes.map((n) => {
                const at = local(n.started_at);
                return (
                  <div key={n.id} className="quote stack-4">
                    <p className="prov">
                      {dayMonthWeekday(at.date)}, {at.time} ·{" "}
                      {who(n.recorded_by)}
                    </p>
                    <p style={{ whiteSpace: "pre-line" }}>{n.note}</p>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {dog.out_of_hours_phone && <CallCard dog={dog} />}

        <p className="prov">
          Prepared by Tailhelm from records entered by {dog.name}&rsquo;s
          household. It is not a clinical record.
        </p>
      </div>
    </Page>
  );
}

const KEY = [
  ["Entered by", "typed into Tailhelm by the household"],
  ["Recorded by", "ticked in Tailhelm at the time shown"],
  ["Lab report", "copied from the clinic's printed report"],
] as const;

/** "Tue 20 Oct" */
function dayMonthWeekday(date: LocalDate) {
  return `${DAYS[weekday(date)]} ${dayMonth(date)}`;
}

/** "14–20 Oct", or "28 Sep–4 Oct" across a month end. */
function spanText(from: LocalDate, to: LocalDate) {
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${Number(from.slice(8))}–${dayMonth(to)}`
    : `${dayMonth(from)}–${dayMonth(to)}`;
}

function WeightCard({
  weights,
  local,
  who,
}: {
  weights: Result[];
  local: (at: string) => { date: LocalDate };
  who: (profile: string | null) => string;
}) {
  const clinic = weights.find((w) => w.scale === "clinic");
  const home = weights.find((w) => w.scale === "home");
  const other = !clinic && !home ? weights[0] : undefined;
  const rows = [
    clinic && { term: "Clinic", w: clinic, by: false },
    home && { term: "Home scale", w: home, by: true },
    other && { term: "Weighed", w: other, by: true },
  ].filter((r): r is { term: string; w: Result; by: boolean } => !!r);
  return (
    <section
      className="card lg stack-12"
      aria-label="Weight"
      style={{ flex: "1 1 300px" }}
    >
      <div className="kicker">
        <span className="m-meas">Weight</span>
      </div>
      {rows.length === 0 ? (
        <p>No weights recorded yet.</p>
      ) : (
        <dl className="dl wide vv-weights">
          {rows.map(({ term, w, by }) => (
            <Fragment key={term}>
              <dt>{term}</dt>
              <dd className="tn">
                <span className="vv-kg">{kgFigure(w.values_json.kg)}</span> kg{" "}
                <span className="c2">
                  · {formatDate(local(w.taken_at).date)}
                  {by && `, ${who(w.recorded_by)}`}
                </span>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}

function ResultsCard({
  rows,
  report,
  local,
  who,
}: {
  rows: LabRow[];
  report: Result;
  local: (at: string) => { date: LocalDate };
  who: (profile: string | null) => string;
}) {
  const reading = (row: LabRow) => {
    if (!row.range) return null;
    const value = Number(row.value);
    return value >= row.range.low && value <= row.range.high
      ? "inside"
      : "outside";
  };
  const value = (row: LabRow) => (
    <>
      {row.value}
      {row.unit && (
        <>
          {" "}
          <span className="c2 ty-sm">{row.unit}</span>
        </>
      )}
    </>
  );
  const typedIn = `Typed in by ${who(report.recorded_by)}${report.created_at ? ` on ${formatDate(local(report.created_at).date)}` : ""}.`;
  return (
    <section
      className="card lg stack-12"
      aria-label="Latest results"
      style={{ flex: "1 1 440px" }}
    >
      <div className="kicker">
        <span className="m-meas">Latest results</span>
        <span className="chip chip-outline">
          Lab report, {formatDate(local(report.taken_at).date)}
        </span>
      </div>
      <table className="vv-lab m-only">
        <thead>
          <tr className="ty-sm c2">
            <th>Test</th>
            <th>Result</th>
            <th>Report range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = reading(row);
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{value(row)}</td>
                <td>
                  {row.range ? (
                    <>
                      {rangeText(row.range)}
                      <br />
                      <span
                        className={r === "outside" ? "ty-sm w6" : "ty-sm c2"}
                      >
                        {r}
                      </span>
                    </>
                  ) : (
                    <span className="ty-sm c2">none given</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="tn d-only" role="table" aria-label="Latest results">
        <div
          role="row"
          className="vv-lab-row ty-label c2"
          style={{ paddingTop: 0, paddingBottom: 10 }}
        >
          <span role="columnheader">Test</span>
          <span role="columnheader" style={{ textAlign: "right" }}>
            Result
          </span>
          <span role="columnheader" style={{ textAlign: "right" }}>
            Report range
          </span>
          <span role="columnheader" />
        </div>
        {rows.map((row) => {
          const r = reading(row);
          return (
            <div key={row.key} role="row" className="vv-lab-row">
              <span role="cell">{row.label}</span>
              <span role="cell" style={{ textAlign: "right" }}>
                {value(row)}
              </span>
              <span
                role="cell"
                style={{ textAlign: "right" }}
                className={row.range ? undefined : "c2 ty-sm"}
              >
                {row.range ? rangeText(row.range) : "none given"}
              </span>
              <span
                role="cell"
                className={r === "outside" ? "ty-sm w6" : "ty-sm c2"}
              >
                {r}
              </span>
            </div>
          );
        })}
      </div>
      <p className="prov">
        Inside and outside compare each result with the range printed on the lab
        report. {typedIn}
      </p>
    </section>
  );
}

function CallCard({
  dog,
}: {
  dog: Pick<Dog, "out_of_hours_name" | "out_of_hours_phone">;
}) {
  const phone = dog.out_of_hours_phone as string;
  return (
    <section className="vv-call" aria-label="Call out-of-hours vet">
      <a className="btn btn-em-outline btn-call" href={telHref(phone)}>
        <Icon name="call" size={28} />
        <span className="lines">
          <span className="l1">Call out-of-hours vet</span>
          <span className="l2 tn">
            {[dog.out_of_hours_name, phone].filter(Boolean).join(" · ")}
          </span>
        </span>
      </a>
    </section>
  );
}
