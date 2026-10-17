import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { SheetLink } from "@/app/_components/sheet-link";
import { addDays, toLocal } from "@/engine/time";
import { dayMonth, longDate, weekdayDate, weekdayDayMonth } from "@/lib/app/dates";
import { cycleView, jewelOf, tileLetters } from "@/lib/app/jewel";
import { getShell } from "@/lib/app/shell";
import { requireSetup } from "@/lib/setup/queries";
import { getReminderIssues } from "@/lib/reminders/health-queries";
import { initial } from "@/lib/app/words";
import { telHref } from "@/lib/dogs/input";
import { doseText, formatDate, planLine } from "@/lib/plan/input";
import type { PlanItem } from "@/lib/plan/queries";
import { getResults } from "@/lib/results/queries";
import { resultTypes } from "@/lib/results/input";
import { signTicks, signsAlertText, signsRule, signsType } from "@/lib/signs/signs";
import { type TodayData, getTodayData } from "@/lib/today/queries";
import { type Countdown, type DoseSlot, buildToday, nextActionText } from "@/lib/today/today";
import { cycleCells, firstDoseOn } from "@/lib/today/view";
import { discardDate, vialRule, vialWarning, vialWarningText } from "@/lib/treatments/vial";
import { getPack } from "@/packs/registry";
import { day31Waits } from "@/lib/plus/offer";
import { CareRing } from "../../_components/care-ring";
import { Page } from "../../_components/page";
import { NoteForm } from "../trends/note-form";
import { removeStressEvent, undoTick } from "./actions";
import { DoseCard, type DoseView } from "./dose-card";
import { Day31 } from "./day31";
import { DoseList } from "./doses";
import type { Vet } from "./guard-sheet";
import { InjectionLog } from "./injection-log";
import { OfflineDay } from "./offline-day";
import { QuickCheck } from "./quick-check";
import { ReminderBanner } from "./reminder-banner";
import { StressEventForm } from "./stress-event-form";
import { type InjectionStat, TodayStats } from "./today-stats";

export const metadata: Metadata = { title: "Today · Tailhelm" };

export default function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TodayContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSetup();
  const [data, shell, { preview }] = await Promise.all([getTodayData(), getShell(), searchParams]);
  if (!data) {
    return (
      <Page title="Today">
        <section className="card stack-16">
          <h2 className="ty-section">Add your dog to see what is due each day</h2>
          <p>
            If someone invited you to help care for their dog, accept on{" "}
            <Link href="/care-team">Care team</Link>.
          </p>
          <Link className="btn btn-primary" href="/dog">
            Add your dog
          </Link>
        </section>
      </Page>
    );
  }
  const { dog, plan, input } = data;
  const short = shell.dog?.conditionShort;
  const today = buildToday(input);
  const sub = (
    <>
      {short ? `Tailhelm for ${short}` : "Today"}
      <span className="d-only"> · {longDate(today.date)}</span>
    </>
  );
  const avatar = (
    <span className="avatar m-only" aria-hidden="true">
      {initial(dog.name)}
    </span>
  );
  if (!plan || plan.items.length === 0) {
    return (
      <Page title={dog.name} sub={sub} aside={avatar} dog space={24}>
        <section className="card stack-16">
          <h2 className="ty-section">Add {dog.name}&rsquo;s care plan</h2>
          <p>Enter each medicine exactly as your vet prescribed it, and it shows here each day.</p>
          <Link className="btn btn-primary" href="/dog">
            Add the care plan
          </Link>
        </section>
      </Page>
    );
  }
  return (
    <TodayBoard
      data={{ ...data, plan }}
      shared={shell.shared}
      at={shell.at}
      myName={shell.me.name}
      today={today}
      conditionShort={short ?? null}
      day31Preview={preview === "day-31"}
    />
  );
}

async function TodayBoard({
  data,
  shared,
  at,
  myName,
  today,
  conditionShort,
  day31Preview,
}: {
  data: TodayData & { plan: NonNullable<TodayData["plan"]> };
  shared: string;
  at: string;
  myName: string;
  today: ReturnType<typeof buildToday>;
  conditionShort: string | null;
  day31Preview: boolean;
}) {
  const { dog, plan, input } = data;
  const pack = getPack(plan.condition.condition_key);
  const signs = signsType(pack);
  const signsAlert = signsRule(pack);
  const vials = vialRule(pack);
  const vet: Vet = { name: dog.vet_name, phone: dog.vet_phone };
  const serverNow = input.now.getTime();
  const itemOf = (id: string) => plan.items.find((i) => i.id === id)!;
  const who = (profile: string | null) =>
    profile === input.me ? "you" : ((profile && input.names[profile]) ?? "someone in the household");
  const nameOf = (profile: string | null) =>
    profile === input.me ? myName : ((profile && input.names[profile]) ?? "Someone");

  const view = (item: PlanItem, slot: string, dueAt: Date, ticks: DoseSlot["ticks"]): DoseView => {
    const line = planLine(item);
    return {
      planItemId: item.id,
      slot,
      dueAt: dueAt.getTime(),
      product: item.product,
      med: line.name,
      amount: doseText(item),
      heading: `${dog.name}’s ${line.name}`,
      line: line.rest,
      set: line.set,
      jewel: jewelOf(item.schedule_json),
      tile: tileLetters(line.name),
      ticks,
    };
  };
  const doses = today.doses.map((d) => view(itemOf(d.item.id), d.slot, d.dueAt, d.ticks));
  const outstanding = today.doses.find((d) => d.status !== "given");
  const tomorrow = outstanding ? null : firstDoseOn(input.items, addDays(today.date, 1), input.timeZone);
  const next = outstanding
    ? view(itemOf(outstanding.item.id), outstanding.slot, outstanding.dueAt, outstanding.ticks)
    : tomorrow && view(itemOf(tomorrow.item.id), tomorrow.slot, tomorrow.dueAt, []);
  const overdue = today.next.kind === "overdue" ? today.next.countdown : null;

  // Enough of the plan to work out another day's doses on the phone with no signal.
  const offlineDoses = plan.items.flatMap((i) =>
    i.schedule_json.kind === "fixed"
      ? [{ id: i.id, product: i.product, med: planLine(i).name, amount: doseText(i), times: i.schedule_json.times }]
      : [],
  );

  const ticks = signs ? signTicks(data.checks, input.me) : {};
  const checkTimes = Object.values(ticks).map((t) => toLocal(new Date(t.at), input.timeZone).time);
  const tickedKeys = Object.keys(ticks);
  const alert = signs && signsAlert ? signsAlertText(signsAlert, tickedKeys, signs, today.date, formatDate) : null;

  const labTypes = resultTypes(pack).map((t) => t.key);
  const [lastResult] = await getResults(plan.condition.id, labTypes, 1);
  const lastResultOn = lastResult ? toLocal(new Date(lastResult.taken_at), input.timeZone).date : null;
  const stressPlan = plan.items.find((i) => i.schedule_json.kind === "event") ?? null;

  const injectionCards = today.countdowns
    .filter((c) => c !== overdue)
    .map((c) => (
      <InjectionCard
        key={c.item.id}
        countdown={c}
        item={itemOf(c.item.id)}
        data={data}
        today={today.date}
        who={who}
        vials={vials}
      />
    ));

  // The injection cycle around the dog's initial, and the countdown in the desktop top bar.
  const cycleItem = today.countdowns[0] ?? null;
  const every = cycleItem?.item.schedule_json.kind === "interval" ? cycleItem.item.schedule_json.everyDays : null;
  const product = cycleItem ? (cycleItem.item.product ?? "Injection") : null;
  const cycle = cycleItem && every && product ? cycleView(product, cycleItem, every, dayMonth) : null;
  const ring = (size: number, className: string, full: boolean) =>
    cycle && every ? (
      <CareRing
        initial={initial(dog.name)}
        day={cycle.day}
        days={every}
        overdue={cycle.overdue}
        size={size}
        label={full ? cycle.fullLabel : cycle.label}
        className={className}
      />
    ) : (
      <span className={`avatar ${className}`} aria-hidden="true">
        {initial(dog.name)}
      </span>
    );
  let injectionStat: InjectionStat | null = null;
  if (cycleItem && cycle && every && product && cycleItem.dueOn !== null && cycleItem.daysUntil !== null) {
    const { dueOn, daysUntil } = cycleItem;
    injectionStat = cycle.overdue
      ? {
          label: `${product} injection`,
          fig: "Overdue",
          sub: `Due ${dayMonth(dueOn)} · ${-daysUntil} ${daysUntil === -1 ? "day" : "days"} ago`,
          overdue: true,
          part: 1,
          days: every,
        }
      : {
          label: `${product} injection`,
          fig: daysUntil === 0 ? "Today" : `${daysUntil} ${daysUntil === 1 ? "day" : "days"}`,
          sub: `Due ${weekdayDayMonth(dueOn)} · day ${cycle.day} of ${every}`,
          overdue: false,
          part: cycle.day / every,
          days: every,
        };
  }
  // Everyone on the list: "Adebayo and Sam", or "Adebayo, Sam and Kit".
  const household = !shared ? myName : shared.includes(" and ") ? `${myName}, ${shared}` : `${myName} and ${shared}`;
  const heroBand = Boolean(next || overdue);

  return (
    <Page
      title={dog.name}
      sub={
        <>
          {conditionShort ? `Tailhelm for ${conditionShort}` : "Today"}
          <span className="d-only"> · {longDate(today.date)}</span>
        </>
      }
      note={cycle && <span className="dog-cycle m-only">{cycle.line}</span>}
      lead={<span className="d-only">{ring(88, "", true)}</span>}
      aside={<span className="m-only">{ring(72, "", false)}</span>}
      dog
      space={24}
      band={heroBand ? "hero" : undefined}
      instrument={
        <TodayStats
          next={next}
          tomorrow={!outstanding}
          slots={today.doses.map((d) => d.slot)}
          injection={injectionStat}
          household={household}
          at={at}
          timeZone={input.timeZone}
          serverNow={serverNow}
        />
      }
    >
      <OfflineDay savedOn={today.date} timeZone={input.timeZone} doses={offlineDoses} shared={shared} />

      <Suspense fallback={null}>
        <RemindersCheck dogId={dog.id} dogName={dog.name} me={input.me} timeZone={input.timeZone} now={input.now} />
      </Suspense>

      {overdue && (
        <OverdueCard countdown={overdue} item={itemOf(overdue.item.id)} data={data} today={today.date} who={who} vet={vet} />
      )}

      {(next || injectionCards.length > 0) && (
        <div className="d-row">
          {next && (
            <DoseCard
              dose={next}
              tomorrow={!outstanding}
              shared={shared}
              dogName={dog.name}
              vet={vet}
              timeZone={input.timeZone}
              serverNow={serverNow}
              className={overdue ? "o-1 d-only" : "o-1"}
            />
          )}
          {injectionCards}
        </div>
      )}

      {doses.length > 0 && (
        <DoseList
          doses={doses}
          nextKey={outstanding ? `${outstanding.item.id}|${outstanding.slot}` : null}
          checkTimes={checkTimes}
          shared={shared}
          at={at}
          dateShort={weekdayDayMonth(today.date)}
          dogName={dog.name}
          vet={vet}
          timeZone={input.timeZone}
          serverNow={serverNow}
        />
      )}

      <div className="d-row">
        {signs && (
          <section className="card lg stack-12 o-5 f-5w" aria-label="Today's check">
            <div className="stack-4">
              <h2 className="r-h">Today&rsquo;s check</h2>
              <p className="hint">Tick what you&rsquo;ve noticed, then save. Kept in the day&rsquo;s notes for your vet.</p>
            </div>
            <QuickCheck
              conditionId={plan.condition.id}
              day={weekdayDayMonth(today.date)}
              storageKey={`th-check:${plan.condition.id}:${today.date}`}
              rows={signs.signs.map((s) => {
                const t = ticks[s.key];
                return {
                  key: s.key,
                  label: s.label,
                  by: t ? `${t.by === input.me ? "You" : nameOf(t.by)}, ${toLocal(new Date(t.at), input.timeZone).time}` : null,
                  mine: t?.mine ?? false,
                };
              })}
            />
            {alert && (
              <div className={signsAlert?.level === "red" ? "banner banner-em" : "banner banner-warn"} role="status">
                <Icon name="alert" />
                <p>{alert}</p>
              </div>
            )}
            <div className="link-row">
              <SheetLink label="Add a note" icon="add">
                <NoteForm dogId={dog.id} today={today.date} />
              </SheetLink>
              <Link className="lnk" href="/today/past">
                Past days
                <Icon name="open" />
              </Link>
            </div>
          </section>
        )}

        <section className="card lg stack-16 o-6 f-4" aria-label="Stressful days">
          <h2 className="r-h">Stressful days</h2>
          {today.events.length > 0 && (
            <ul className="stress-list">
              {today.events.map((e) => (
                <li key={e.id}>
                  <span className="tn w5">
                    {e.ongoing
                      ? e.endsOn
                        ? `Until ${weekdayDayMonth(e.endsOn)}`
                        : "Today"
                      : weekdayDayMonth(e.startsOn)}
                  </span>
                  <span>
                    {e.title}
                    {!e.ongoing && e.endsOn && <span className="c2"> · to {weekdayDayMonth(e.endsOn)}</span>}
                  </span>
                  {data.eventOwners[e.id] === input.me && (
                    <form action={removeStressEvent}>
                      <input type="hidden" name="event_id" value={e.id} />
                      <button className="lnk" type="submit" style={{ minHeight: 24 }} aria-label={`Remove ${e.title}`}>
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {stressPlan?.vet_instructions ? (
            <div className="quote stack-4">
              <p className="ty-label c2">Your vet&rsquo;s plan, as you entered it</p>
              <p className="tn" style={{ whiteSpace: "pre-line" }}>
                &ldquo;{stressPlan.vet_instructions}&rdquo;
              </p>
              <p className="prov">
                {[
                  stressPlan.set_by_vet_on && `Set by vet ${formatDate(stressPlan.set_by_vet_on)}`,
                  stressPlan.created_by && `entered by ${nameOf(stressPlan.created_by)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
                  .replace(/^entered/, "Entered")}
              </p>
            </div>
          ) : (
            <p className="hint">
              There is no stress plan for {dog.name} yet. Ask your vet what to do on days like these, then{" "}
              <Link href="/dog">add it in their words</Link>.
            </p>
          )}
          <div className="link-row">
            <SheetLink label="Add a stressful day" icon="add">
              <StressEventForm dogId={dog.id} today={today.date} />
            </SheetLink>
            <Link className="lnk" href="/today/past">
              Past days
              <Icon name="open" />
            </Link>
          </div>
        </section>

        {(today.tests.length > 0 || lastResultOn) && (
          <section className="panel stack-12 o-4 f-3 blood-panel" aria-label="Blood tests">
            <h2 className="ty-title m-meas">Blood tests</h2>
            <dl className="dl blood-dl">
              <div>
                <dt>Last</dt>
                <dd className="tn">{lastResultOn ? weekdayDate(lastResultOn) : "None recorded yet"}</dd>
              </div>
              {today.tests.map((t) => {
                const upcoming = t.upcoming?.[0];
                return (
                  <div key={t.item.id}>
                    <dt>Next</dt>
                    <dd className="tn">
                      {upcoming ? (
                        <>
                          {weekdayDate(upcoming.dueOn)}{" "}
                          <span className="c2">· day {upcoming.day} after the injection</span>
                        </>
                      ) : t.upcoming === null ? (
                        <span className="c2">Shows once an injection is recorded</span>
                      ) : (
                        <span className="c2">None left in this cycle</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="prov">
              {today.tests[0] && itemOf(today.tests[0].item.id).created_by
                ? `Dates entered by ${nameOf(itemOf(today.tests[0].item.id).created_by)}. `
                : ""}
              Results are in <Link href="/trends">Trends</Link>.
            </p>
          </section>
        )}
      </div>

      <Suspense fallback={null}>
        <Day31
          dog={dog}
          conditionIds={[plan.condition.id]}
          medicines={plan.items.flatMap((i) =>
            i.schedule_json.kind === "fixed" || i.schedule_json.kind === "interval"
              ? [{ name: i.product ?? "Medicine", mark: i.schedule_json.kind === "fixed" ? ("pred" as const) : ("zyc" as const) }]
              : [],
          )}
          me={input.me}
          names={{ ...input.names, [input.me]: myName }}
          timeZone={input.timeZone}
          now={input.now}
          today={today.date}
          waits={day31Waits({ doses: today.doses, injections: today.countdowns, now: input.now, alert: Boolean(alert), happeningNow: false })}
          preview={day31Preview}
        />
      </Suspense>
    </Page>
  );
}

/** "22 Sep by Sam": the last injection logged and who gave it. */
function lastGiven(data: TodayData, itemId: string, who: (p: string | null) => string) {
  const last = data.injections[itemId]?.last ?? null;
  if (!last) return null;
  return { last, text: `${dayMonth(last.given_on)} by ${last.given_by ?? who(last.given_by_profile)}` };
}

function vialOptions(data: TodayData, itemId: string, vials: ReturnType<typeof vialRule>) {
  return (data.injections[itemId]?.vials ?? []).map((v) => ({
    id: v.id,
    label: [
      v.batch ? `Batch ${v.batch}` : "Vial",
      v.opened_on && `opened ${formatDate(v.opened_on)}`,
      v.opened_on && vials && `use by ${formatDate(discardDate(v.opened_on, vials))}`,
      v.expires_on && `expires ${formatDate(v.expires_on)}`,
    ]
      .filter(Boolean)
      .join(", "),
  }));
}

function RecordInjection({
  item,
  data,
  today,
  vials,
  label = "Record the injection",
  className,
}: {
  item: PlanItem;
  data: TodayData;
  today: string;
  vials: ReturnType<typeof vialRule>;
  label?: string;
  className?: string;
}) {
  return (
    <SheetLink label={label} title={`Record ${item.product ?? "the injection"}`} className={className}>
      <InjectionLog
        planItemId={item.id}
        today={today}
        amount={item.dose_amount}
        unit={item.dose_unit}
        vials={vialOptions(data, item.id, vials)}
      />
    </SheetLink>
  );
}

function PlanText({ item }: { item: PlanItem }) {
  const line = planLine(item);
  return (
    <>
      {line.name} {line.rest}
      {line.set && <>{" "}<span className="c2 nowrap">{line.set}</span></>}
    </>
  );
}

function InjectionCard({
  countdown,
  item,
  data,
  today,
  who,
  vials,
}: {
  countdown: Countdown;
  item: PlanItem;
  data: TodayData;
  today: string;
  who: (p: string | null) => string;
  vials: ReturnType<typeof vialRule>;
}) {
  const { dueOn, daysUntil } = countdown;
  const given = lastGiven(data, item.id, who);
  const name = `${data.dog.name}’s ${item.product ?? "injection"}`;
  const every = item.schedule_json.kind === "interval" ? item.schedule_json.everyDays : null;
  const cycle = given && every ? cycleCells(given.last.given_on, today, every) : null;
  const lastVial = given?.last.vial_id ? data.injections[item.id]?.vials.find((v) => v.id === given.last.vial_id) : undefined;
  const warning = vialWarning(lastVial?.opened_on ?? null, vials, today);
  return (
    <section className="card lg stack-20 o-3 f-5 inj-card" aria-label="Next injection">
      <div className="kicker">
        <span className="kick-med">
          {tileLetters(item.product ?? "") && (
            <span className={`med ${jewelOf(item.schedule_json)}`} aria-hidden="true">
              {tileLetters(item.product ?? "")}
            </span>
          )}
          Next injection
        </span>
        {dueOn && <span className="tn d-only">{weekdayDayMonth(dueOn)}</span>}
      </div>
      {dueOn !== null && daysUntil !== null ? (
        <div className="stack-4">
          {daysUntil === 0 ? (
            <>
              <p className="r-fig-md">Today</p>
              <p className="ty-lead">{name} is due today</p>
            </>
          ) : (
            <>
              <p className="figline">
                <span className="r-fig-md">{daysUntil}</span>
                <span className="unit">{daysUntil === 1 ? "day" : "days"}</span>
              </p>
              <p className="ty-lead">
                to {name}, on {dayMonth(dueOn)}
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="ty-lead">The next date shows once the last injection is recorded.</p>
      )}
      {given && cycle && every && dueOn && (
        <div className="stack-8">
          <div className="cycle" role="img" aria-label={`Day ${cycle.day} of a ${every}-day cycle`}>
            {cycle.cells.map((c, i) => (
              <span key={i} className={c} />
            ))}
          </div>
          <div className="cycle-scale d-only" aria-hidden="true">
            {[1, ...Array.from({ length: Math.floor(every / 7) }, (_, k) => 7 * (k + 1))]
              .filter((d, i, all) => all.indexOf(d) === i && d <= every)
              .concat(every % 7 ? [every] : [])
              .map((d) => (
                <span key={d} style={{ left: `${(((d - 0.5) / every) * 100).toFixed(2)}%` }}>
                  {d}
                </span>
              ))}
          </div>
          <div className="row between prov m-only">
            <span>{dayMonth(given.last.given_on)}, last given</span>
            <span>
              Day {cycle.day} of {every}
            </span>
            <span>{dayMonth(dueOn)}</span>
          </div>
          <div className="row between prov d-only">
            <span>{given.text.replace(" by ", " · last given by ")}</span>
            <span>{dayMonth(dueOn)} · due</span>
          </div>
        </div>
      )}
      <hr className="hr" />
      <dl className="dl">
        {given && (
          <>
            <dt className="m-only">Last given</dt>
            <dd className="m-only">{given.text}</dd>
          </>
        )}
        {cycle && every && (
          <>
            <dt className="d-only">Today</dt>
            <dd className="d-only">
              Day {cycle.day} of {every}
            </dd>
          </>
        )}
        <dt>Plan</dt>
        <dd>
          <PlanText item={item} />
        </dd>
      </dl>
      {warning && vials && (
        <div className="banner banner-warn" role="status">
          <Icon name="alert" />
          <p>{vialWarningText(warning, vials, formatDate)}</p>
        </div>
      )}
      <div className="row gap-16" style={{ flexWrap: "wrap", marginTop: -8, marginBottom: -12 }}>
        <RecordInjection item={item} data={data} today={today} vials={vials} />
        {given && given.last.given_by_profile === data.input.me && (
          <form action={undoTick}>
            <input type="hidden" name="treatment_id" value={given.last.id} />
            <button type="submit" className="lnk">
              Undo the last one
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function OverdueCard({
  countdown,
  item,
  data,
  today,
  who,
  vet,
}: {
  countdown: Countdown;
  item: PlanItem;
  data: TodayData;
  today: string;
  who: (p: string | null) => string;
  vet: Vet;
}) {
  const text = nextActionText({ kind: "overdue", countdown }, data.dog.name, (d) => dayMonth(d));
  const given = lastGiven(data, item.id, who);
  const vials = vialRule(getPack(data.plan!.condition.condition_key));
  const every = item.schedule_json.kind === "interval" ? `every ${item.schedule_json.everyDays} days` : null;
  const set = planLine(item).set;
  const call = (height: number) =>
    vet.phone ? (
      <a className="btn btn-emergency btn-call" href={telHref(vet.phone)} style={{ minHeight: height }}>
        <Icon name="call" size={28} />
        <span className="lines">
          <span className="l1">Call {vet.name ?? "your vet"}</span>
          <span className="l2">{vet.phone}</span>
        </span>
      </a>
    ) : (
      <Link className="btn btn-secondary" href="/dog">
        Add your vet&rsquo;s number
      </Link>
    );
  const chip = (
    <span className="chip chip-em" style={{ alignSelf: "flex-start" }}>
      <Icon name="alert" />
      Injection overdue
    </span>
  );
  return (
    <section className="card lg is-em o-1" role="alert" aria-label="Injection overdue">
      <div className="m-only stack-16">
        <div className="kicker">{chip}</div>
        <div className="stack-8">
          <p className="ty-section tn">{text.title}</p>
          <p className="ty-lead w6">{text.detail}</p>
        </div>
        {call(80)}
        <dl className="dl">
          {given && (
            <>
              <dt>Last given</dt>
              <dd>{given.text}</dd>
            </>
          )}
          {every && (
            <>
              <dt>Plan</dt>
              <dd>
                {every.charAt(0).toUpperCase() + every.slice(1)}
                {set && <>{" "}<span className="c2 nowrap">{set}</span></>}
              </dd>
            </>
          )}
        </dl>
        <RecordInjection item={item} data={data} today={today} vials={vials} label="Already given? Record the injection" />
      </div>
      <div className="d-only overdue-desk">
        <div className="stack-12" style={{ flex: "1 1 440px" }}>
          {chip}
          <p className="tn" style={{ fontSize: 30, lineHeight: "36px", fontWeight: 600, textWrap: "balance" }}>
            {text.title}
          </p>
          <p style={{ fontSize: 20, lineHeight: "28px", fontWeight: 600 }}>{text.detail}</p>
          <p className="prov">
            {[given && `Last given ${given.text}`, every].filter(Boolean).join(" · ")}
            {set && <>{" "}<span className="nowrap">{set}</span></>}
          </p>
        </div>
        <div className="stack-8" style={{ flex: "0 1 380px" }}>
          {call(96)}
          <div style={{ alignSelf: "center" }}>
            <RecordInjection item={item} data={data} today={today} vials={vials} label="Already given? Record the injection" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The amber banner while a reminder layer has stopped working for the person signed in. */
async function RemindersCheck(args: { dogId: string; dogName: string; me: string; timeZone: string; now: Date }) {
  return <ReminderBanner issues={await getReminderIssues(args)} />;
}
