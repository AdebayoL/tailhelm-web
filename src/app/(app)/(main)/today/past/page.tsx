import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toLocal } from "@/engine/time";
import { dayMonth, monthYear } from "@/lib/app/dates";
import { dogHasPlus, hasRecordsBefore } from "@/lib/history/queries";
import { FREE_DAYS, historyStart } from "@/lib/history/window";
import { formatDate } from "@/lib/plan/input";
import { periodText } from "@/lib/plus/offer";
import { resultTypes } from "@/lib/results/input";
import { requireSetup } from "@/lib/setup/queries";
import { signsType } from "@/lib/signs/signs";
import { type RecordGroup, filterDays, pastDays, pastMonths } from "@/lib/today/past";
import { getPastRecords, getTodayData } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";
import { HistoryLine } from "../../../_components/history-line";
import { Page } from "../../../_components/page";
import { Month } from "./days";
import { type MonthLink, MonthNav } from "./months";

export const metadata: Metadata = { title: "Past days · Tailhelm" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function PastDaysPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <PastDays searchParams={searchParams} />
    </Suspense>
  );
}

const FILTERS: { key: RecordGroup | null; label: string }[] = [
  { key: null, label: "All records" },
  { key: "doses", label: "Doses" },
  { key: "checks", label: "Checks and notes" },
  { key: "measurements", label: "Measurements" },
];

const parseFilter = (raw: string | string[] | undefined) => FILTERS.find((f) => f.key !== null && f.key === raw)?.key ?? null;

/** All records, or one kind, kept in the address so a refresh keeps it. */
function FilterSwitch({ group }: { group: RecordGroup | null }) {
  return (
    <nav className="seg" aria-label="Show">
      {FILTERS.map((f) => (
        <Link
          key={f.label}
          href={f.key ? `/today/past?show=${f.key}` : "/today/past"}
          className={f.key === group ? "seg-item on" : "seg-item"}
          aria-current={f.key === group ? "page" : undefined}
          scroll={false}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

async function PastDays({ searchParams }: { searchParams: SearchParams }) {
  await requireSetup();
  const [data, { show }] = await Promise.all([getTodayData(), searchParams]);
  if (!data) {
    return (
      <Page title="Past days">
        <section className="card stack-16">
          <p>Add your dog first. Each day&rsquo;s doses, checks, notes and measurements then show here.</p>
          <Link className="btn btn-primary" href="/dog" style={{ alignSelf: "flex-start", width: "auto" }}>
            Go to Dog
          </Link>
        </section>
      </Page>
    );
  }

  const { dog, plan, input } = data;
  const pack = plan ? getPack(plan.condition.condition_key) : null;
  const signs = signsType(pack);
  const today = toLocal(input.now, input.timeZone).date;
  const plus = await dogHasPlus(dog.id);
  const from = historyStart(today, plus);
  const conditionId = plan?.condition.id ?? null;
  const [records, older] = await Promise.all([
    getPastRecords(dog.id, conditionId, input.timeZone, from),
    from ? hasRecordsBefore(dog.id, conditionId, from, input.timeZone) : false,
  ]);
  const all = pastDays(
    { ...records, signs: signs?.signs ?? [], signsKey: signs?.key ?? null, labTypes: resultTypes(pack) },
    today,
    input.timeZone,
    from,
  );
  const group = parseFilter(show);
  const months = pastMonths(filterDays(all, group), from);
  const who = (profile: string | null) => (profile && input.names[profile]) || null;
  const earliest = all.length > 0 ? all[all.length - 1].date : null;
  const sub = from
    ? `${dog.name} · the last ${FREE_DAYS} days · ${periodText(from, today)}`
    : `${dog.name} · ${earliest ? `everything since ${formatDate(earliest)}` : "everything recorded"} · Plus`;

  if (months.length === 0) {
    return (
      <Page title="Past days" sub={sub} actions={all.length > 0 ? <FilterSwitch group={group} /> : undefined} space={24}>
        <section className="card lg stack-12">
          <p>
            {all.length > 0
              ? `Nothing of this kind ${from ? `in the last ${FREE_DAYS} days` : "yet"}.`
              : `Nothing has been recorded ${from ? `in the last ${FREE_DAYS} days` : "yet"}.`}
          </p>
          {older && <HistoryLine />}
          <Link className="lnk" href="/today">
            Back to Today
          </Link>
        </section>
      </Page>
    );
  }

  const links: MonthLink[] = months.map((m) => {
    const first = `${m.key}-01`;
    return {
      key: m.key,
      short: monthYear(first).slice(0, 3),
      long: monthYear(first).split(" ")[0],
      year: m.key.slice(0, 4),
      count: m.from ? `from ${dayMonth(m.from)}` : `${m.days.length} ${m.days.length === 1 ? "day" : "days"}`,
    };
  });
  // The first day on Tailhelm, unless records were typed in for days before it.
  const added = toLocal(new Date(dog.created_at), input.timeZone).date;
  const boundary =
    earliest && earliest >= added ? `${dog.name}’s first day on Tailhelm, ${formatDate(added)}` : earliest ? `The earliest record, ${formatDate(earliest)}` : null;

  return (
    <Page title="Past days" sub={sub} actions={<FilterSwitch group={group} />} space={24}>
      <div className="pd-desk">
        <MonthNav
          months={links}
          variant="rail"
          hint={
            <p className="hint">
              {from ? `Free accounts show the last ${FREE_DAYS} days.` : `Everything since ${dog.name}’s first day is on screen.`} Nothing is ever deleted.
            </p>
          }
        />
        <div className="pd-main stack-24">
          <MonthNav months={links} variant="strip" />
          {months.map((m, i) => (
            <Month key={m.key} month={m} shown={i === 0 ? 3 : 1} who={who} />
          ))}
          {from ? older && <HistoryLine /> : boundary && <p className="boundary">{boundary}</p>}
        </div>
      </div>
    </Page>
  );
}
