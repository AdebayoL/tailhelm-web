import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { weekdayDate, weekdayDayMonth } from "@/lib/app/dates";
import { getShell } from "@/lib/app/shell";
import { joinNames } from "@/lib/app/words";
import { requireOwner } from "@/lib/auth/session";
import { type Call, emergencyCalls } from "@/lib/dogs/hours";
import { telHref } from "@/lib/dogs/input";
import { getMyDog } from "@/lib/dogs/queries";
import { formatDate, planLine } from "@/lib/plan/input";
import { getDogPlan } from "@/lib/plan/queries";
import { getResults } from "@/lib/results/queries";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { getLastGiven } from "@/lib/treatments/queries";
import { WEIGHT_TYPE, vetWeight } from "@/lib/weight/input";
import { conditionName } from "@/packs/names";
import { PageStatus } from "../_components/page";
import { OwnerOnly } from "../_components/owner-only";
import { CloseButton } from "./close-button";
import { FullScreenCard } from "./full-screen";

export const metadata: Metadata = { title: "Emergency · Tailhelm" };

/**
 * Reachable in one tap from every screen and built for the 3 a.m. rule: no
 * typing, no choices, large targets. The crisis checklist will appear here
 * only from an attested condition pack.
 */
export default function EmergencyPage() {
  return (
    <div className="em">
      <OwnerOnly />
      <header className="em-hdr">
        <div>
          <h1 className="em-title">Emergency</h1>
          <Suspense fallback={null}>
            <When />
          </Suspense>
        </div>
        <CloseButton />
      </header>
      <PageStatus />
      <main className="em-main">
        <Suspense fallback={null}>
          <Calls />
        </Suspense>
      </main>
    </div>
  );
}

async function When() {
  const { dog, at, timeZone } = await getShell();
  return (
    <p className="d-sub d-only">
      {dog ? `${dog.name} · ` : ""}
      {weekdayDate(toLocal(new Date(), timeZone).date)}, {at}
    </p>
  );
}

/** The first number, as large as the design makes it. On a phone the button dials; on a computer the number is printed large to dial from any phone. */
function CallFirst({ call }: { call: Call }) {
  return (
    <a className="btn btn-emergency em-first" href={telHref(call.phone)}>
      <Icon name="call" size={32} />
      <span className="lines">
        <span className="l1">{call.title}</span>
        <span className="l2 tn">
          {call.sub ?? <span className="m-only">{call.phone}</span>}
        </span>
        <span className="l3 tn d-only">{call.phone}</span>
      </span>
    </a>
  );
}

function CallSecond({ call }: { call: Call }) {
  return (
    <a className="btn btn-secondary btn-call em-second" href={telHref(call.phone)}>
      <Icon name="call" size={28} />
      <span className="lines">
        <span className="l1">{call.title}</span>
        <span className="l2 tn">
          {call.sub ?? <span className="m-only">{call.phone}</span>}
          <span className="d-only">
            {call.sub ? " · " : ""}
            {call.phone}
          </span>
        </span>
      </span>
    </a>
  );
}

async function Calls() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  if (!dog) {
    return (
      <div className="em-calls stack-16">
        <p className="ty-lead">Add your dog and your vet&rsquo;s numbers, and they show here as call buttons.</p>
        <Link className="btn btn-primary" href="/dog">
          Add your dog
        </Link>
      </div>
    );
  }
  const [plan, names, timeZone] = await Promise.all([getDogPlan(dog.id), householdNames(dog.id), getTimeZone(owner.userId)]);
  // Daily medicines first, then injections, as the card is read top down at the clinic desk.
  const meds = (plan?.items ?? [])
    .filter((i) => i.schedule_json.kind === "fixed" || i.schedule_json.kind === "interval")
    .sort((a, b) => Number(a.schedule_json.kind === "interval") - Number(b.schedule_json.kind === "interval"));
  const [last, weights] = await Promise.all([
    getLastGiven(meds.map((i) => i.id)),
    plan ? getResults(plan.condition.id, [WEIGHT_TYPE], 20) : Promise.resolve([]),
  ]);
  const weight = vetWeight(
    weights.map((w) => ({ kg: w.values_json.kg, scale: w.scale, on: toLocal(new Date(w.taken_at), timeZone).date })),
    formatDate,
  );
  const who = (profile: string | null) =>
    (profile && names[profile]) ?? (profile === owner.userId ? "you" : "someone in the household");
  const { first, second, why } = emergencyCalls(
    { name: dog.vet_name, phone: dog.vet_phone, hours: dog.vet_hours },
    { name: dog.out_of_hours_name, phone: dog.out_of_hours_phone, hours: dog.out_of_hours_hours },
    new Date(),
    timeZone,
  );
  const enteredBy = joinNames(
    [...new Set((plan?.items ?? []).map((i) => i.created_by).filter((p): p is string => !!p))]
      .map((p) => names[p])
      .filter(Boolean)
      .sort(),
  );
  const facts = [dog.breed, weight?.text].filter(Boolean);

  return (
    <>
      <div className="em-calls stack-16">
        {first ? (
          <>
            <CallFirst call={first} />
            {second && <CallSecond call={second} />}
            <p className="prov">
              {why ? `${why} ` : ""}
              <span className="d-only">On a computer, the numbers are large enough to dial from any phone.</span>
            </p>
          </>
        ) : (
          <>
            <div className="banner banner-em" role="alert">
              <Icon name="alert" />
              <p>
                <b>No vet numbers saved yet.</b> Add your vet&rsquo;s number and the out-of-hours number, and they show
                here as call buttons.
              </p>
            </div>
            <Link className="btn btn-primary" href="/dog">
              Add your vet&rsquo;s numbers
            </Link>
          </>
        )}
      </div>

      <FullScreenCard title={<h2 className="r-h em-card-t">Emergency card</h2>}>
        <div className="panel em-panel">
          <div>
            <p className="em-dog">
              {dog.name}
              {plan && ` · ${conditionName(plan.condition.condition_key)}`}
            </p>
            {facts.length > 0 && <p className="ty-lead tn">{facts.join(" · ")}</p>}
          </div>
          {meds.length > 0 && (
            <>
              <hr className="hr" />
              {meds.map((i) => {
                const line = planLine(i);
                const l = last[i.id];
                const when =
                  l &&
                  (i.schedule_json.kind === "fixed"
                    ? `${toLocal(new Date(l.given_at), timeZone).time} ${weekdayDayMonth(l.given_on)}`
                    : formatDate(l.given_on));
                return (
                  <div key={i.id} className="stack-4">
                    <p className="ty-lead tn">
                      <b className="w6">{line.name}</b> {line.rest}
                      {line.set && (
                        <>
                          {" "}
                          <span className="c2 nowrap">{line.set}</span>
                        </>
                      )}
                    </p>
                    <p className="prov">
                      {l ? `Last given ${when} by ${l.given_by ?? who(l.given_by_profile)}` : "Not recorded yet"}
                    </p>
                  </div>
                );
              })}
            </>
          )}
          {(dog.vet_phone || dog.out_of_hours_phone) && (
            <>
              <hr className="hr" />
              <dl className="dl em-dl">
                {dog.vet_phone && (
                  <>
                    <dt>Own vet</dt>
                    <dd>
                      {dog.vet_name ? `${dog.vet_name} · ` : ""}
                      {dog.vet_phone}
                    </dd>
                  </>
                )}
                {dog.out_of_hours_phone && (
                  <>
                    <dt>Out of hours</dt>
                    <dd>
                      {dog.out_of_hours_name ? `${dog.out_of_hours_name} · ` : ""}
                      {dog.out_of_hours_phone}
                    </dd>
                  </>
                )}
              </dl>
            </>
          )}
          <p className="prov">{enteredBy ? `Entered by ${enteredBy}.` : "Entered by your household."} Not checked by a vet.</p>
        </div>
      </FullScreenCard>
    </>
  );
}
