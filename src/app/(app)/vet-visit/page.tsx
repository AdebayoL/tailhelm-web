import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { addDays, toLocal } from "@/engine/time";
import { telHref } from "@/lib/dogs/input";
import { describePlanItem, formatDate } from "@/lib/plan/input";
import { derivedDefs, describeValue, resultTypes } from "@/lib/results/input";
import { getResults } from "@/lib/results/queries";
import { signsType } from "@/lib/signs/signs";
import { getTodayData } from "@/lib/today/queries";
import { buildToday } from "@/lib/today/today";
import { doseStatusText, wellbeingDays } from "@/lib/vetvisit/summary";
import { WEIGHT_TYPE, describeWeight } from "@/lib/weight/input";
import { CONDITION_NAMES } from "@/packs/pack-sql";
import { getPack } from "@/packs/registry";

export const metadata: Metadata = { title: "Vet visit · Tailhelm" };

const callButton =
  "flex min-h-[72px] items-center justify-center rounded-2xl bg-emergency px-6 text-center text-xl font-semibold text-white";
const quietLink = "min-h-12 text-lg text-green underline underline-offset-4";
const card = "flex flex-col gap-2 rounded-2xl border border-rule bg-card p-4";

/**
 * One screen to hand to a vet standing next to the dog: the condition, the
 * plan as the vet set it, the last injection, today's doses, the latest
 * results, weight, the last 7 days of checks and planned stressful events.
 */
export default function VetVisitPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-lg">Loading…</p>}>
        <VetVisit />
      </Suspense>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function VetVisit() {
  const data = await getTodayData();
  if (!data?.plan) {
    return (
      <>
        <h1 className="text-3xl font-semibold">Vet visit</h1>
        <p className="text-lg">
          <Link href="/dog" className={quietLink}>
            Add your dog and their plan
          </Link>{" "}
          and this screen will gather it for your vet.
        </p>
      </>
    );
  }
  const { dog, plan, input } = data;
  const today = buildToday(input);
  const pack = getPack(plan.condition.condition_key);
  const types = resultTypes(pack);
  const signs = signsType(pack);
  const [results, weights, checks] = await Promise.all([
    getResults(
      plan.condition.id,
      types.map((t) => t.key),
    ),
    getResults(plan.condition.id, [WEIGHT_TYPE], 2),
    signs ? getResults(plan.condition.id, [signs.key]) : Promise.resolve([]),
  ]);
  const localDate = (at: string) => toLocal(new Date(at), input.timeZone).date;
  const weekAgo = addDays(today.date, -6);
  const condition = plan.condition;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{dog.name} · Vet visit</h1>
        <p className="text-lg">
          {CONDITION_NAMES[condition.condition_key] ?? condition.condition_key}
          {condition.variant && ` (${condition.variant})`}
          {condition.diagnosed_on && `, diagnosed ${formatDate(condition.diagnosed_on)}`}.
        </p>
        <p className="text-base">Shown on {formatDate(today.date)}. Everything here was recorded by the household.</p>
      </header>

      <Section id="plan" title="The plan, as the vet set it">
        {plan.items.length === 0 ? (
          <p className="text-lg">No medicines recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plan.items.map((i) => (
              <li key={i.id} className={card}>
                <p className="text-lg">{describePlanItem(i)}</p>
                {i.vet_instructions && <p className="whitespace-pre-line text-base">Vet&rsquo;s words: {i.vet_instructions}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {today.countdowns.length > 0 && (
        <Section id="injection" title="Last injection">
          {today.countdowns.map((c) => {
            const last = data.injections[c.item.id]?.last;
            return (
              <div key={c.item.id} className={card}>
                <p className="text-lg font-semibold">{c.item.product}</p>
                <p className="text-lg">
                  {last
                    ? `Given ${formatDate(last.given_on)}${last.amount !== null ? `, ${last.amount} ${last.unit}` : ""}${last.site ? `, ${last.site}` : ""}.`
                    : "None logged yet."}
                </p>
                {c.dueOn && (
                  <p className="text-lg">
                    {c.daysUntil! < 0 ? `Was due ${formatDate(c.dueOn)}.` : `Next due ${formatDate(c.dueOn)}.`}
                  </p>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {today.doses.length > 0 && (
        <Section id="doses" title={`Today’s doses, ${formatDate(today.date)}`}>
          <ul className="flex flex-col gap-1">
            {today.doses.map((d) => (
              <li key={`${d.item.id}-${d.slot}`} className="text-lg">
                {doseStatusText(d)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {types.map((type) => {
        const latest = results.find((r) => r.type_key === type.key);
        return (
          <Section key={type.key} id={`latest-${type.key}`} title={`Latest ${type.name.toLowerCase()}`}>
            {!latest ? (
              <p className="text-lg">No results yet.</p>
            ) : (
              <div className={card}>
                <p className="text-lg font-semibold">
                  {formatDate(localDate(latest.taken_at))}
                  {latest.days_since_anchor !== null &&
                    latest.cycle_no !== null &&
                    `, day ${latest.days_since_anchor} after injection ${latest.cycle_no}`}
                </p>
                {type.fields.map(
                  (f) =>
                    latest.values_json[f.key] !== undefined && (
                      <p key={f.key} className="text-lg">
                        {describeValue(f, latest.values_json[f.key], latest.ranges_json?.[f.key])}
                      </p>
                    ),
                )}
                {derivedDefs(pack, type.key).map(
                  (d) =>
                    latest.derived_json?.[d.key] !== undefined && (
                      <p key={d.key} className="text-lg">
                        {d.name} {latest.derived_json[d.key].toFixed(1)}.
                      </p>
                    ),
                )}
              </div>
            )}
          </Section>
        );
      })}

      <Section id="weight" title="Weight">
        <p className="text-lg">
          {weights[0]
            ? `${formatDate(localDate(weights[0].taken_at))}: ${describeWeight(
                weights[0].values_json.kg,
                weights[1] ? { kg: weights[1].values_json.kg, on: localDate(weights[1].taken_at) } : null,
                formatDate,
              )}`
            : "No weights yet."}
        </p>
      </Section>

      {signs && (
        <Section id="week" title={`${signs.name}, last 7 days`}>
          <ul className="flex flex-col gap-1">
            {wellbeingDays(
              checks.filter((c) => localDate(c.taken_at) >= weekAgo),
              signs.signs,
              today.date,
              input.timeZone,
            ).map((d) => (
              <li key={d.date} className="text-lg">
                {formatDate(d.date)}: {d.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="events" title="Stressful events planned">
        {today.events.length === 0 ? (
          <p className="text-lg">None planned.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {today.events.map((e) => (
              <li key={e.id} className="text-lg">
                {e.title}: {formatDate(e.startsOn)}
                {e.endsOn && ` to ${formatDate(e.endsOn)}`}.
              </li>
            ))}
          </ul>
        )}
      </Section>

      {dog.out_of_hours_phone && (
        <a href={telHref(dog.out_of_hours_phone)} className={callButton}>
          Call out-of-hours vet · {dog.out_of_hours_phone}
        </a>
      )}
    </>
  );
}
