import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { addDays, toLocal } from "@/engine/time";
import { weekdayDate, weekdayDayMonth } from "@/lib/app/dates";
import { dogHasPlus, hasRecordsBefore } from "@/lib/history/queries";
import { FREE_DAYS, historyStart } from "@/lib/history/window";
import { signsType } from "@/lib/signs/signs";
import { pastDays } from "@/lib/today/past";
import { getPastRecords, getTodayData } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";
import { HistoryLine } from "../../../_components/history-line";
import { Page } from "../../../_components/page";
import { requireSetup } from "@/lib/setup/queries";

export const metadata: Metadata = { title: "Past days · Tailhelm" };

export default function PastDaysPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <PastDays />
    </Suspense>
  );
}

async function PastDays() {
  await requireSetup();
  const data = await getTodayData();
  if (!data) {
    return (
      <Page title="Past days">
        <section className="card stack-16">
          <p>Add your dog first. Each day&rsquo;s check, notes and stressful days then show here.</p>
          <Link className="btn btn-primary" href="/dog" style={{ alignSelf: "flex-start", width: "auto" }}>
            Go to Dog
          </Link>
        </section>
      </Page>
    );
  }

  const { dog, plan, input } = data;
  const signs = plan ? signsType(getPack(plan.condition.condition_key)) : null;
  const today = toLocal(input.now, input.timeZone).date;
  const from = historyStart(today, await dogHasPlus(dog.id));
  const [records, older] = await Promise.all([
    getPastRecords(dog.id, plan?.condition.id ?? null, signs?.key ?? null, input.timeZone, from),
    from ? hasRecordsBefore(dog.id, plan?.condition.id ?? null, from, input.timeZone) : false,
  ]);
  const days = pastDays({ ...records, signs: signs?.signs ?? [] }, today, input.timeZone, from);
  const who = (profile: string | null) =>
    profile === input.me ? "You" : ((profile && input.names[profile]) ?? "Someone in the household");
  const dayName = (date: string) =>
    date === today ? `Today, ${weekdayDayMonth(date)}` : date === addDays(today, -1) ? `Yesterday, ${weekdayDayMonth(date)}` : weekdayDate(date);
  const span = (s: { startsOn: string; endsOn: string | null }) =>
    s.endsOn && s.endsOn !== s.startsOn ? `${weekdayDayMonth(s.startsOn)} to ${weekdayDayMonth(s.endsOn)}` : null;

  return (
    <Page
      title="Past days"
      sub={from ? `${dog.name} · the last ${FREE_DAYS} days, as recorded by the household` : `${dog.name} · every day recorded by the household`}
      space={24}
    >
      {days.length === 0 ? (
        <section className="card lg stack-12">
          <p>
            Nothing has been ticked, noted or marked as a stressful day{" "}
            {from ? `in the last ${FREE_DAYS} days` : "yet"}.
          </p>
          {older && <HistoryLine />}
          <Link className="lnk" href="/today">
            Back to Today
          </Link>
        </section>
      ) : (
        <div className="stack-16">
          {days.map((d) => (
            <section key={d.date} className="card lg past-day" aria-label={dayName(d.date)}>
              <h2 className="r-h">{dayName(d.date)}</h2>

              {d.signs.length > 0 && (
                <div className="stack-4">
                  <h3 className="ty-label c2">Signs ticked on the check</h3>
                  <ul className="past-list">
                    {d.signs.map((s) => (
                      <li key={s.key}>
                        <span>{s.label}</span>
                        <span className="prov">
                          {who(s.by)}, {s.time}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {d.notes.length > 0 && (
                <div className="stack-4">
                  <h3 className="ty-label c2">Notes</h3>
                  <ul className="past-list">
                    {d.notes.map((n) => (
                      <li key={n.id} className="note">
                        <span className="prov">
                          {who(n.by)}
                          {n.time && `, ${n.time}`}
                        </span>
                        <p style={{ whiteSpace: "pre-line" }}>{n.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {d.stress.length > 0 && (
                <div className="stack-4">
                  <h3 className="ty-label c2">Stressful day</h3>
                  <ul className="past-list">
                    {d.stress.map((s) => (
                      <li key={s.id}>
                        <span>{s.title}</span>
                        <span className="prov">{span(s)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
          <p className="hint">
            Days with nothing ticked, noted or marked don&rsquo;t show. Weights and lab reports are in{" "}
            <Link href="/trends">Trends</Link>.
          </p>
          {older && <HistoryLine />}
        </div>
      )}
    </Page>
  );
}
