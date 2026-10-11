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
import { getNotes } from "@/lib/notes/queries";
import { WEIGHT_TYPE, describeWeight } from "@/lib/weight/input";
import { getTimeZone } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";
import { TabPage } from "../_components/tab-page";
import { removeNote, removeResult } from "./actions";
import { NoteForm } from "./note-form";
import { ResultForm } from "./result-form";
import { WeightForm } from "./weight-form";

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
  const [results, weights, notes, timeZone] = await Promise.all([
    getResults(plan.condition.id, types.map((t) => t.key)),
    getResults(plan.condition.id, [WEIGHT_TYPE]),
    getNotes(dog.id),
    getTimeZone(owner.userId),
  ]);
  const today = toLocal(new Date(), timeZone).date;
  const localDate = (at: string) => toLocal(new Date(at), timeZone).date;

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
                    <li key={r.id} className="flex flex-col gap-1 rounded-2xl border border-rule bg-card p-4">
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

      <section aria-labelledby="weight" className="flex flex-col gap-4">
        <h2 id="weight" className="text-xl font-semibold">
          Weight
        </h2>
        <WeightForm conditionId={plan.condition.id} today={today} />
        {weights.length === 0 ? (
          <p className="text-lg">No weights yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {weights.map((w, i) => {
              const before = weights[i + 1];
              return (
                <li key={w.id} className="flex flex-col gap-1 rounded-2xl border border-rule bg-card p-4">
                  <p className="text-lg font-semibold">{formatDate(localDate(w.taken_at))}</p>
                  <p className="text-lg">
                    {describeWeight(
                      w.values_json.kg,
                      before ? { kg: before.values_json.kg, on: localDate(before.taken_at) } : null,
                      formatDate,
                    )}
                  </p>
                  {w.note && <p className="text-base">Note: {w.note}</p>}
                  {w.recorded_by === owner.userId && (
                    <form action={removeResult}>
                      <input type="hidden" name="observation_id" value={w.id} />
                      <button type="submit" className={quietLink}>
                        Remove this weight
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="notes" className="flex flex-col gap-4">
        <h2 id="notes" className="text-xl font-semibold">
          Notes
        </h2>
        <NoteForm dogId={dog.id} today={today} />
        {notes.length === 0 ? (
          <p className="text-lg">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 rounded-2xl border border-rule bg-card p-4">
                <p className="text-lg font-semibold">{formatDate(localDate(n.started_at))}</p>
                <p className="whitespace-pre-line text-lg">{n.note}</p>
                {n.recorded_by === owner.userId && (
                  <form action={removeNote}>
                    <input type="hidden" name="event_id" value={n.id} />
                    <button type="submit" className={quietLink}>
                      Remove this note
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
