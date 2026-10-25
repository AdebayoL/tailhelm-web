import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { SheetClose, SheetLink } from "@/app/_components/sheet-link";
import { type LocalDate, toLocal } from "@/engine/time";
import { dayMonth, weekdayDate, weekdayDayMonth } from "@/lib/app/dates";
import { requireOwner } from "@/lib/auth/session";
import { requireSetup } from "@/lib/setup/queries";
import { getMyDog } from "@/lib/dogs/queries";
import { dogHasPlus, hasRecordsBefore } from "@/lib/history/queries";
import { FREE_DAYS, historyStart } from "@/lib/history/window";
import { getNotes } from "@/lib/notes/queries";
import { tileLetters } from "@/lib/app/jewel";
import { formatDate } from "@/lib/plan/input";
import { getDogPlan } from "@/lib/plan/queries";
import { type Range, type ResultType, derivedDefs, resultTypes } from "@/lib/results/input";
import { type Result, getResults } from "@/lib/results/queries";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { getInjectionDates } from "@/lib/treatments/queries";
import {
  DESK_FRAME,
  PERIODS,
  PHONE_FRAME,
  type Period,
  parsePeriod,
  periodStart,
  periodText,
  spanText,
  weightChart,
} from "@/lib/trends/chart";
import { type Scale, WEIGHT_TYPE, kgFigure } from "@/lib/weight/input";
import { getPack } from "@/packs/registry";
import { HistoryLine } from "../../_components/history-line";
import { Page } from "../../_components/page";
import { removeNote, removeResult } from "./actions";
import { LabList, LabTable, labRows, rangeText } from "./lab-report";
import { LabMeasure, typedInAll } from "./lab-history";
import { NoteForm } from "./note-form";
import { ResultForm } from "./result-form";
import { CycleFigure } from "./cycle-figure";
import { ClinicKey, HomeKey, InjectionKey, WeightChart } from "./weight-chart";
import { WeightForm } from "./weight-form";
import { TrendsNoticed } from "../today/noticed/card";

export const metadata: Metadata = { title: "Trends · Tailhelm" };

const SUB = "numbers as recorded, with their source";

export default function TrendsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <TrendsContent searchParams={searchParams} />
    </Suspense>
  );
}

/** 30 days, 6 months or all, kept in the address so a refresh or a shared link keeps it. */
function PeriodSwitch({ period }: { period: Period }) {
  return (
    <nav className="seg" aria-label="Period">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={p.key === "6m" ? "/trends" : `/trends?period=${p.key}`}
          className={p.key === period ? "seg-item on" : "seg-item"}
          aria-current={p.key === period ? "page" : undefined}
          scroll={false}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

const scaleWords: Record<Scale | "none", { long: string; short: string; lower: string }> = {
  clinic: { long: "Clinic scale", short: "Clinic", lower: "clinic scale" },
  home: { long: "Home scale", short: "Home", lower: "home scale" },
  none: { long: "Scale not recorded", short: "Not recorded", lower: "scale not recorded" },
};
const scaleOf = (w: Result) => scaleWords[w.scale ?? "none"];

async function TrendsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const owner = await requireOwner();
  await requireSetup();
  const [{ period: rawPeriod }, dog] = await Promise.all([searchParams, getMyDog()]);
  const plan = dog ? await getDogPlan(dog.id) : null;
  if (!dog || !plan) {
    return (
      <Page title="Trends" sub={dog ? `${dog.name} · ${SUB}` : SUB}>
        <section className="card stack-16">
          <h2 className="ty-section">Add {dog ? `${dog.name}’s` : "your dog’s"} condition to see trends</h2>
          <p>Weights, lab reports and notes show here as numbers with their date and source.</p>
          <Link className="btn btn-primary" href="/dog">
            {dog ? "Add their condition" : "Add your dog"}
          </Link>
        </section>
      </Page>
    );
  }

  const pack = getPack(plan.condition.condition_key);
  const types = resultTypes(pack);
  const injectionItems = plan.items.filter((i) => i.schedule_json.kind === "interval");
  const [results, allWeights, allNotes, timeZone, names, plus] = await Promise.all([
    getResults(plan.condition.id, types.map((t) => t.key)),
    getResults(plan.condition.id, [WEIGHT_TYPE], 500),
    getNotes(dog.id),
    getTimeZone(owner.userId),
    householdNames(dog.id),
    dogHasPlus(dog.id),
  ]);
  const local = (at: string) => toLocal(new Date(at), timeZone);
  const today = local(new Date().toISOString()).date;
  // Free accounts see the last 30 days; Plus can choose any period.
  const period = plus ? parsePeriod(rawPeriod) : "30d";
  const windowStart = historyStart(today, plus);
  const shown = (at: string) => windowStart === null || local(at).date >= windowStart;
  const earliest = allWeights.length > 0 ? local(allWeights[allWeights.length - 1].taken_at).date : null;
  const from = periodStart(period, today, earliest);
  const [injections, older] = await Promise.all([
    getInjectionDates(
      injectionItems.map((i) => i.id),
      from,
    ),
    windowStart ? hasRecordsBefore(dog.id, plan.condition.id, windowStart, timeZone) : false,
  ]);
  const notes = allNotes.filter((n) => shown(n.started_at));
  const who = (profile: string | null) => (profile && names[profile]) || "someone in the household";
  const weights = allWeights.filter((w) => local(w.taken_at).date >= from);
  const sameYear = (d: LocalDate) => d.slice(0, 4) === today.slice(0, 4);

  const weightForm = (
    <SheetLink label="Add a weight" icon="add">
      <WeightForm conditionId={plan.condition.id} today={today} dogName={dog.name} />
    </SheetLink>
  );
  const allWeightsSheet = weights.length > 0 && (
    <SheetLink label={`All ${weights.length} ${weights.length === 1 ? "weight" : "weights"}`} title="Weights" after="open">
      <WeightSheet weights={weights} local={local} who={who} me={owner.userId} />
      <SheetClose />
    </SheetLink>
  );

  return (
    <Page title="Trends" sub={`${dog.name} · ${SUB}`} actions={plus ? <PeriodSwitch period={period} /> : undefined} band="overlap">
      {weights.length === 0 ? (
        <section className="card lg stack-16" aria-label="Weight">
          <div className="kicker">
            <span className="m-meas">Weight</span>
            <span className="tn">
              <span className="m-only">{periodText(period, from)}</span>
              <span className="d-only">{spanText(period, from, today)}</span>
            </span>
          </div>
          <p className="ty-lead">No weights {allWeights.length > 0 ? "in this period" : "yet"}.</p>
          <p className="prov">
            Each weight shows here with its date, whose scale and who entered it. Clinic and home scales are kept apart, as
            scales can differ.
          </p>
          {weightForm}
        </section>
      ) : (
        <WeightCards
          weights={weights}
          from={from}
          today={today}
          period={period}
          injections={injections}
          injectionName={injectionItems[0]?.product ?? null}
          local={local}
          who={who}
          sameYear={sameYear}
          weightForm={weightForm}
          allWeightsSheet={allWeightsSheet}
        />
      )}

      {types.map((type) => (
        <LabCard
          key={type.key}
          type={type}
          reports={results.filter((r) => r.type_key === type.key && shown(r.taken_at))}
          olderKept={results.some((r) => r.type_key === type.key && !shown(r.taken_at))}
          lastRanges={results.find((r) => r.type_key === type.key)?.ranges_json ?? {}}
          dogName={dog.name}
          conditionId={plan.condition.id}
          today={today}
          pack={pack}
          local={local}
          who={who}
          me={owner.userId}
        />
      ))}

      <Notes notes={notes} olderKept={notes.length < allNotes.length} dogId={dog.id} today={today} local={local} who={who} me={owner.userId} />

      <Suspense fallback={null}>
        <TrendsNoticed dog={dog} today={today} />
      </Suspense>

      {older && <HistoryLine />}
    </Page>
  );
}

type Local = (at: string) => { date: LocalDate; time: string };

function WeightCards({
  weights,
  from,
  today,
  period,
  injections,
  injectionName,
  local,
  who,
  sameYear,
  weightForm,
  allWeightsSheet,
}: {
  weights: Result[];
  from: LocalDate;
  today: LocalDate;
  period: Period;
  injections: LocalDate[];
  injectionName: string | null;
  local: Local;
  who: (p: string | null) => string;
  sameYear: (d: LocalDate) => boolean;
  weightForm: ReactNode;
  allWeightsSheet: ReactNode;
}) {
  const latest = weights[0];
  const points = weights.map((w) => ({ on: local(w.taken_at).date, kg: w.values_json.kg, scale: w.scale }));
  const phone = weightChart(points, from, today, period, PHONE_FRAME, injections);
  const desk = weightChart(points, from, today, period, DESK_FRAME, injections);
  const kgs = points.map((p) => p.kg);
  const summary = `Weight from ${spanText(period, from, today)}, between ${kgFigure(Math.min(...kgs))} and ${kgFigure(Math.max(...kgs))} kg`;
  const hasClinic = points.some((p) => p.scale === "clinic");
  const hasOther = points.some((p) => p.scale !== "clinic");
  const otherKey = points.some((p) => p.scale === null) ? "Home or unrecorded scale" : "Home scale";
  const marked = injectionName && desk.marks.length > 0;
  const source = `${formatDate(local(latest.taken_at).date)} · ${scaleOf(latest).lower} · entered by ${who(latest.recorded_by)}`;
  // With both kinds of scale in view, the latest of each, side by side and never compared.
  const latestClinic = weights.find((w) => w.scale === "clinic");
  const latestOther = weights.find((w) => w.scale !== "clinic");
  const pair = latestClinic && latestOther ? [latestClinic, latestOther] : null;
  const pairSource = (w: Result) =>
    `${scaleOf(w).long} · ${sameYear(local(w.taken_at).date) ? dayMonth(local(w.taken_at).date) : formatDate(local(w.taken_at).date)} · ${who(w.recorded_by)}`;
  const count = (scale: "clinic" | "other") => points.filter((p) => (scale === "clinic") === (p.scale === "clinic")).length;
  const mark = injectionName ? tileLetters(injectionName) : null;

  return (
    <div className="d-row">
      <section className="card lg stack-16 wt-card" aria-label="Weight" style={{ flex: "8 1 600px" }}>
        <div className="kicker">
          <span className="m-meas">Weight</span>
          <span className="tn">
            <span className="m-only">{periodText(period, from)}</span>
            <span className="d-only">{spanText(period, from, today)}</span>
          </span>
        </div>
        {pair ? (
          <div className="wt-pair">
            {pair.map((w) => (
              <div key={w.id} className="stack-4">
                <p className="figline">
                  <span className="r-fig-md">{kgFigure(w.values_json.kg)}</span>
                  <span className="unit">kg</span>
                </p>
                <p className="prov">{pairSource(w)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="wt-head">
            <p className="figline">
              <span className="r-fig-md">{kgFigure(latest.values_json.kg)}</span>
              <span className="unit">kg</span>
            </p>
            <p className="prov">{source}</p>
          </div>
        )}
        <CycleFigure cycle={Boolean(marked)}>
          <div className="m-only">
            <WeightChart chart={phone} frame={PHONE_FRAME} desk={false} mark={mark} summary={marked ? `${summary}, with ${injectionName} injection dates marked` : summary} />
          </div>
          <div className="d-only">
            <WeightChart chart={desk} frame={DESK_FRAME} desk mark={mark} summary={marked ? `${summary}, with ${injectionName} injection dates marked` : summary} />
          </div>
          <figcaption className="row gap-16 prov wt-legend" style={{ flexWrap: "wrap" }}>
            {hasClinic && (
              <span className="row gap-8">
                <ClinicKey />
                Clinic scale, {count("clinic")}
              </span>
            )}
            {hasOther && (
              <span className="row gap-8">
                <HomeKey />
                {otherKey}, {count("other")}
              </span>
            )}
            {marked && (
              <span className="row gap-8 ov">
                <InjectionKey />
                {injectionName} given
              </span>
            )}
          </figcaption>
        </CycleFigure>
        {(hasClinic && hasOther) || marked ? (
          <p className="prov">
            {hasClinic && hasOther && "Clinic and home scales are kept apart and never joined, as scales can differ. "}
            {marked && `${injectionName} days are drawn on the dates recorded.`}
          </p>
        ) : null}
        <div className="m-only stack-16">
          <table className="tn" style={{ width: "100%", borderCollapse: "collapse" }}>
            <caption className="sr">Recent weights</caption>
            <tbody>
              {weights.slice(0, 3).map((w, i, rows) => (
                <tr key={w.id} style={{ borderTop: "1px solid var(--line)", borderBottom: i === rows.length - 1 ? "1px solid var(--line)" : undefined }}>
                  <td style={{ padding: "10px 0", width: 104 }}>{formatDate(local(w.taken_at).date)}</td>
                  <td style={{ padding: "10px 16px 10px 0", textAlign: "right", width: 72 }}>
                    {kgFigure(w.values_json.kg)} <span className="c2">kg</span>
                  </td>
                  <td className="prov" style={{ padding: "10px 0" }}>
                    {scaleOf(w).long} · {who(w.recorded_by)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row gap-24" style={{ flexWrap: "wrap" }}>
            {allWeightsSheet}
            {weightForm}
          </div>
        </div>
      </section>

      <section className="card lg stack-12 d-only" aria-label="All weights" style={{ flex: "4 1 300px" }}>
        <div className="kicker">
          <span>All weights</span>
          <span className="tn">{weights.length}</span>
        </div>
        <div className="tn">
          {weights.slice(0, 8).map((w, i, rows) => {
            const on = local(w.taken_at).date;
            return (
              <div
                key={w.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "96px 64px minmax(0, 1fr)",
                  columnGap: 12,
                  alignItems: "baseline",
                  padding: "10px 0",
                  borderBottom: i === rows.length - 1 ? undefined : "1px solid var(--line)",
                }}
              >
                <span>{sameYear(on) ? dayMonth(on) : formatDate(on)}</span>
                <span style={{ textAlign: "right" }}>
                  {kgFigure(w.values_json.kg)} <span className="c2">kg</span>
                </span>
                <span className="prov">
                  {scaleOf(w).short} · {who(w.recorded_by)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="row between" style={{ flexWrap: "wrap", gap: "0 16px", marginTop: "auto" }}>
          {weightForm}
          {allWeightsSheet}
        </div>
      </section>
    </div>
  );
}

/** Every weight in the period, with its note, and Remove on the ones you entered. */
function WeightSheet({ weights, local, who, me }: { weights: Result[]; local: Local; who: (p: string | null) => string; me: string }) {
  return (
    <ol className="recs">
      {weights.map((w, i) => (
        <li key={w.id} className="stack-4" style={{ padding: "12px 20px", borderTop: i ? "1px solid var(--line)" : undefined }}>
          <div className="row between tn" style={{ alignItems: "baseline", gap: 12 }}>
            <span>{formatDate(local(w.taken_at).date)}</span>
            <span>
              {kgFigure(w.values_json.kg)} <span className="c2">kg</span>
            </span>
          </div>
          <p className="prov">
            {scaleOf(w).long} · {who(w.recorded_by)}
            {w.note && ` · ${w.note}`}
          </p>
          {w.recorded_by === me && (
            <form action={removeResult}>
              <input type="hidden" name="observation_id" value={w.id} />
              <button type="submit" className="lnk" style={{ minHeight: 32 }}>
                Remove this weight
              </button>
            </form>
          )}
        </li>
      ))}
    </ol>
  );
}

function typedIn(report: Result, local: Local, who: (p: string | null) => string): string {
  const by = `Typed in by ${who(report.recorded_by)} from the printed report`;
  return report.created_at ? `${by} on ${formatDate(local(report.created_at).date)}` : by;
}

function LabCard({
  type,
  reports,
  olderKept,
  lastRanges,
  dogName,
  conditionId,
  today,
  pack,
  local,
  who,
  me,
}: {
  type: ResultType;
  /** The reports the account's history reaches, latest first. */
  reports: Result[];
  /** Whether older reports are kept beyond a free account's 30 days. */
  olderKept: boolean;
  /** The ranges on the latest report of all, to start the next one from. */
  lastRanges: Record<string, Range>;
  dogName: string;
  conditionId: string;
  today: LocalDate;
  pack: ReturnType<typeof getPack>;
  local: Local;
  who: (p: string | null) => string;
  me: string;
}) {
  const addReport = (
    <SheetLink
      label="Add a lab report"
      icon="add"
      intro="Copy each number and the range printed beside it on the lab report. Leave a range blank if the report has none."
    >
      <ResultForm conditionId={conditionId} type={type} derived={derivedDefs(pack, type.key)} today={today} lastRanges={lastRanges} />
    </SheetLink>
  );
  const chip = <span className="chip chip-outline">From lab report</span>;

  if (reports.length === 0) {
    return (
      <section className="card lg stack-16" aria-label={type.name}>
        <div className="kicker">
          <span className="m-meas">Blood tests</span>
        </div>
        <div className="stack-4">
          <h2 className="r-h">{olderKept ? `No lab reports in the last ${FREE_DAYS} days` : "No lab reports yet"}</h2>
          <p className="prov">
            Type in the results from a printed lab report, and each one shows against the range printed on it.
          </p>
        </div>
        {addReport}
      </section>
    );
  }

  const [latest, ...earlier] = reports;
  const rows = labRows(type, latest, pack);
  const across = reports.length > 1;
  return (
    <section className="card lg stack-16" aria-label="Blood test results">
      {across ? (
        <>
          <div className="kicker">
            <span className="m-meas">Blood tests</span>
            <span className="chip chip-outline tn">{reports.length} lab reports</span>
          </div>
          <p className="prov">
            Each result is drawn against the range printed on its own report. The band is the report&rsquo;s range; a hollow point sits
            outside it.
          </p>
          <div className="stack-16">
            {type.fields.map((f) => (
              <LabMeasure key={f.key} field={f} reports={reports} local={local} />
            ))}
          </div>
          <p className="prov">{typedInAll(reports, local, who)}</p>
        </>
      ) : (
        <>
          <div className="kicker m-only">
            <span className="m-meas">Blood tests</span>
            {chip}
          </div>
          <div className="row between" style={{ flexWrap: "wrap", gap: "8px 16px", alignItems: "baseline" }}>
            <div className="stack-4">
              <h2 className="r-h tn d-meas">Lab report, {formatDate(local(latest.taken_at).date)}</h2>
              <p className="prov">{typedIn(latest, local, who)}</p>
            </div>
            <span className="d-only">{chip}</span>
          </div>
          <LabList rows={rows} />
          <LabTable rows={rows} />
          {latest.note && <p className="prov">Note: {latest.note}</p>}
        </>
      )}
      <div className="row between" style={{ flexWrap: "wrap", gap: "8px 16px" }}>
        <p className="prov">Your vet can explain what these results mean for {dogName}.</p>
        <div className="row gap-24" style={{ flexWrap: "wrap" }}>
          <SheetLink
            label={earlier.length > 0 ? `Earlier reports (${earlier.length})` : "Report details"}
            title="Lab reports"
            after="open"
          >
            <ol className="recs">
              {reports.map((r, i) => (
                <li key={r.id} className="stack-8" style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--line)" : undefined }}>
                  <div className="stack-4">
                    <p className="w6 tn">Lab report, {formatDate(local(r.taken_at).date)}</p>
                    <p className="prov">{typedIn(r, local, who)}</p>
                  </div>
                  <ul className="stack-4">
                    {labRows(type, r, pack).map((row) => {
                      const v = Number(row.value);
                      const reading = !row.range
                        ? "no range given on your lab report"
                        : v >= row.range.low && v <= row.range.high
                          ? "inside the range on your lab report"
                          : "outside the range on your lab report";
                      return (
                        <li key={row.key} className="tn">
                          <b className="w6">{row.label}</b> {row.value}
                          {row.unit && ` ${row.unit}`},{" "}
                          <span className="c2">
                            {reading}
                            {row.range && <span className="nowrap"> ({rangeText(row.range)})</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {r.note && <p className="prov">Note: {r.note}</p>}
                  {r.recorded_by === me && (
                    <form action={removeResult}>
                      <input type="hidden" name="observation_id" value={r.id} />
                      <button type="submit" className="lnk" style={{ minHeight: 32 }}>
                        Remove this report
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
            <SheetClose />
          </SheetLink>
          {addReport}
        </div>
      </div>
    </section>
  );
}

function Notes({
  notes,
  olderKept,
  dogId,
  today,
  local,
  who,
  me,
}: {
  notes: Awaited<ReturnType<typeof getNotes>>;
  /** Whether older notes are kept beyond a free account's 30 days. */
  olderKept: boolean;
  dogId: string;
  today: LocalDate;
  local: Local;
  who: (p: string | null) => string;
  me: string;
}) {
  const add = (
    <SheetLink label="Add a note" icon="add">
      <NoteForm dogId={dogId} today={today} />
    </SheetLink>
  );
  // The time is shown only when the note was written on the day it is about; a note added later is about the day alone.
  const when = (n: (typeof notes)[number]) => {
    const on = local(n.started_at);
    const day = on.date.slice(0, 4) === today.slice(0, 4) ? weekdayDayMonth(on.date) : weekdayDate(on.date);
    const written = n.created_at ? local(n.created_at).date : null;
    return written === on.date ? `${day}, ${on.time}` : day;
  };
  const remove = (n: (typeof notes)[number]) =>
    n.recorded_by === me && (
      <form action={removeNote}>
        <input type="hidden" name="event_id" value={n.id} />
        <button type="submit" className="lnk" style={{ minHeight: 32 }} aria-label={`Remove the note from ${when(n)}`}>
          Remove
        </button>
      </form>
    );
  const empty = (
    <p className="prov">
      {olderKept ? `No notes in the last ${FREE_DAYS} days.` : "No notes yet."} A note keeps what you noticed, with your name and the
      time, for your vet.
    </p>
  );

  return (
    <>
      <section className="sec m-only" aria-label="Notes">
        <div className="sec-h" style={{ alignItems: "center" }}>
          <h2 className="sec-t">Notes</h2>
          {add}
        </div>
        {notes.length === 0 ? (
          empty
        ) : (
          <ol className="recs">
            {notes.map((n, i) => (
              <li key={n.id} className="stack-4" style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--line)" : undefined }}>
                <p className="prov">
                  {when(n)} · {who(n.recorded_by)}
                </p>
                <p style={{ whiteSpace: "pre-line" }}>{n.note}</p>
                {remove(n)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card lg stack-12 d-only" aria-label="Notes">
        <div className="sec-h" style={{ alignItems: "center" }}>
          <h2 className="d-h">Notes</h2>
          {add}
        </div>
        {notes.length === 0 ? (
          empty
        ) : (
          <div>
            {notes.map((n) => (
              <div
                key={n.id}
                style={{ display: "grid", gridTemplateColumns: "168px minmax(0, 1fr)", columnGap: 24, padding: "14px 0", borderTop: "1px solid var(--line)", alignItems: "baseline" }}
              >
                <span className="prov" style={{ fontSize: 16 }}>
                  {when(n)}
                  <br />
                  {who(n.recorded_by)}
                </span>
                <div className="stack-4">
                  <p style={{ whiteSpace: "pre-line" }}>{n.note}</p>
                  {remove(n)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
