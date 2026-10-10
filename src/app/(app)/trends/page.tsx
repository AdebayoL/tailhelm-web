import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toLocal } from "@/engine/time";
import { TABS } from "@/lib/app/nav";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { formatDate } from "@/lib/plan/input";
import { getDogPlan } from "@/lib/plan/queries";
import { derivedDefs, describeValue, resultTypes } from "@/lib/results/input";
import { getResults } from "@/lib/results/queries";
import { getTimeZone } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";
import { TabPage } from "../_components/tab-page";
import { removeResult } from "./actions";
import { ResultForm } from "./result-form";

export const metadata: Metadata = { title: "Trends · Tailhelm" };

const quietLink = "min-h-12 text-lg text-green underline underline-offset-4";

export default function TrendsPage() {
  return (
    <TabPage tab={TABS[1]}>
      <Suspense fallback={<p className="text-lg">Loading…</p>}>
        <Results />
      </Suspense>
    </TabPage>
  );
}

async function Results() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  const plan = dog ? await getDogPlan(dog.id) : null;
  if (!dog || !plan) {
    return (
      <p className="text-lg">
        <Link href="/dog" className={quietLink}>
          Add your dog and their condition
        </Link>{" "}
        to record blood test results.
      </p>
    );
  }
  const pack = getPack(plan.condition.condition_key);
  const types = resultTypes(pack);
  const [results, timeZone] = await Promise.all([getResults(plan.condition.id), getTimeZone(owner.userId)]);
  const today = toLocal(new Date(), timeZone).date;

  return (
    <>
      {types.map((type) => {
        const ofType = results.filter((r) => r.type_key === type.key);
        const defs = derivedDefs(pack, type.key);
        return (
          <section key={type.key} aria-labelledby={`log-${type.key}`} className="flex flex-col gap-4">
            <h2 id={`log-${type.key}`} className="text-xl font-semibold">
              Log a {type.name.toLowerCase()} result
            </h2>
            <ResultForm conditionId={plan.condition.id} type={type} derived={defs} today={today} lastRanges={ofType[0]?.ranges_json ?? {}} />

            <h2 className="pt-4 text-xl font-semibold">{type.name} results</h2>
            {ofType.length === 0 ? (
              <p className="text-lg">No results yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {ofType.map((r) => {
                  const taken = toLocal(new Date(r.taken_at), timeZone).date;
                  return (
                    <li key={r.id} className="flex flex-col gap-1 rounded-2xl border border-ink/30 p-4">
                      <p className="text-lg font-semibold">
                        {formatDate(taken)}
                        {r.days_since_anchor !== null && r.cycle_no !== null && `, day ${r.days_since_anchor} after injection ${r.cycle_no}`}
                      </p>
                      {type.fields.map(
                        (f) =>
                          r.values_json[f.key] !== undefined && (
                            <p key={f.key} className="text-lg">
                              {describeValue(f, r.values_json[f.key], r.ranges_json?.[f.key])}
                            </p>
                          ),
                      )}
                      {defs.map(
                        (d) =>
                          r.derived_json?.[d.key] !== undefined && (
                            <p key={d.key} className="text-lg">
                              {d.name} {r.derived_json[d.key].toFixed(1)}.
                            </p>
                          ),
                      )}
                      {r.note && <p className="text-base">Note: {r.note}</p>}
                      {r.recorded_by === owner.userId && (
                        <form action={removeResult}>
                          <input type="hidden" name="observation_id" value={r.id} />
                          <button type="submit" className={quietLink}>
                            Remove this result
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
