import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { telHref } from "@/lib/dogs/input";
import { describePlanItem, formatDate } from "@/lib/plan/input";
import { getTodayData } from "@/lib/today/queries";
import { buildToday, nextActionText } from "@/lib/today/today";
import { discardDate, vialRule, vialWarning, vialWarningText } from "@/lib/treatments/vial";
import { getPack } from "@/packs/registry";
import { TabPage } from "../_components/tab-page";
import { undoTick } from "./actions";
import { DoseTick } from "./dose-tick";
import { InjectionLog } from "./injection-log";

export const metadata: Metadata = { title: "Today · Tailhelm" };

const callButton =
  "flex min-h-[72px] items-center justify-center rounded-2xl bg-emergency px-6 text-center text-xl font-semibold text-white";
const quietLink = "min-h-12 text-lg text-green underline underline-offset-4";

export default function TodayPage() {
  return (
    <TabPage tab={TABS[0]}>
      <Suspense fallback={<p className="text-lg">Loading…</p>}>
        <TodayContent />
      </Suspense>
    </TabPage>
  );
}

async function TodayContent() {
  const data = await getTodayData();
  if (!data) {
    return (
      <p className="text-lg">
        <Link href="/dog" className={quietLink}>
          Add your dog
        </Link>{" "}
        to see what is due each day.
      </p>
    );
  }
  const { dog, plan, input } = data;
  if (!plan || plan.items.length === 0) {
    return (
      <p className="text-lg">
        <Link href="/dog" className={quietLink}>
          Add {dog.name}&rsquo;s medicines
        </Link>{" "}
        as your vet prescribed them, and they will show here each day.
      </p>
    );
  }

  const today = buildToday(input);
  const { next } = today;
  const card = nextActionText(next, dog.name, formatDate);
  const overdue = next.kind === "overdue";
  const vials = vialRule(getPack(plan.condition.condition_key));

  return (
    <>
      <section
        aria-labelledby="next-action"
        className={`flex flex-col gap-4 rounded-2xl border-2 p-5 ${overdue ? "border-alert-red" : "border-green"}`}
      >
        <h2 id="next-action" className="text-2xl font-semibold leading-snug">
          {card.title}
        </h2>
        {card.detail && <p className="text-xl">{card.detail}</p>}
        {next.kind === "dose" && (
          <DoseTick
            planItemId={next.dose.item.id}
            slot={next.dose.slot}
            ticks={next.dose.ticks}
          />
        )}
        {overdue &&
          (dog.vet_phone ? (
            <a href={telHref(dog.vet_phone)} className={callButton}>
              Call {dog.vet_name ?? "your vet"} · {dog.vet_phone}
            </a>
          ) : (
            <Link href="/dog" className={quietLink}>
              Add your vet&rsquo;s number
            </Link>
          ))}
      </section>

      {today.doses.length > 0 && (
        <section aria-labelledby="doses" className="flex flex-col gap-4">
          <h2 id="doses" className="text-xl font-semibold">
            Today, {formatDate(today.date)}
          </h2>
          <ul className="flex flex-col gap-4">
            {today.doses.map((d) => (
              <li
                key={`${d.item.id}-${d.slot}`}
                className="flex flex-col gap-3 rounded-2xl border border-ink/30 p-4"
              >
                <p className="text-xl font-semibold">
                  {d.slot} · {d.item.product}
                </p>
                <p className="text-base">
                  {describePlanItem(
                    plan.items.find((i) => i.id === d.item.id)!,
                  )}
                </p>
                {d.status === "late" && (
                  <p className="text-lg font-semibold">
                    Not ticked yet. It was due at {d.slot}.
                  </p>
                )}
                <DoseTick
                  planItemId={d.item.id}
                  slot={d.slot}
                  ticks={d.ticks}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {today.countdowns.length > 0 && (
        <section aria-labelledby="injections" className="flex flex-col gap-3">
          <h2 id="injections" className="text-xl font-semibold">
            Injections
          </h2>
          {today.countdowns.map((c) => {
            const planItem = plan.items.find((i) => i.id === c.item.id)!;
            const info = data.injections[c.item.id] ?? {
              last: null,
              vials: [],
            };
            const last = info.last;
            const lastVial = last?.vial_id ? info.vials.find((v) => v.id === last.vial_id) : undefined;
            const warning = vialWarning(lastVial?.opened_on ?? null, vials, today.date);
            const by = last
              ? (last.given_by ??
                (last.given_by_profile === input.me
                  ? "you"
                  : ((last.given_by_profile &&
                      input.names[last.given_by_profile]) ??
                    "someone in the household")))
              : null;
            return (
              <div
                key={c.item.id}
                className="flex flex-col gap-3 rounded-2xl border border-ink/30 p-4"
              >
                <p className="text-xl font-semibold">{c.item.product}</p>
                <p className="text-base">{describePlanItem(planItem)}</p>
                <p className="text-lg">
                  {c.dueOn === null
                    ? "The next date shows once the last injection is logged."
                    : c.daysUntil! < 0
                      ? `Was due on ${formatDate(c.dueOn)}.`
                      : c.daysUntil === 0
                        ? "Due today."
                        : `Due on ${formatDate(c.dueOn)}, in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}.`}
                </p>
                {last && (
                  <div className="flex flex-col gap-1">
                    <p className="text-lg">
                      Last given {formatDate(last.given_on)}
                      {last.amount !== null && `, ${last.amount} ${last.unit}`},
                      by {by}
                      {last.site && `, ${last.site}`}.
                    </p>
                    {last.given_by_profile === input.me && (
                      <form action={undoTick}>
                        <input
                          type="hidden"
                          name="treatment_id"
                          value={last.id}
                        />
                        <button type="submit" className={quietLink}>
                          Undo this entry
                        </button>
                      </form>
                    )}
                  </div>
                )}
                {warning && vials && (
                  <p role="status" className="rounded-xl border-2 border-alert-amber p-3 text-lg">
                    {vialWarningText(warning, vials, formatDate)}
                  </p>
                )}
                <InjectionLog
                  planItemId={c.item.id}
                  product={c.item.product ?? "injection"}
                  today={today.date}
                  amount={planItem.dose_amount}
                  unit={planItem.dose_unit}
                  vials={info.vials.map((v) => ({
                    id: v.id,
                    label: [
                      v.batch ? `Batch ${v.batch}` : "Vial",
                      v.opened_on && `opened ${formatDate(v.opened_on)}`,
                      v.opened_on && vials && `use by ${formatDate(discardDate(v.opened_on, vials))}`,
                      v.expires_on && `expires ${formatDate(v.expires_on)}`,
                    ]
                      .filter(Boolean)
                      .join(", "),
                  }))}
                />
              </div>
            );
          })}
        </section>
      )}

      {today.tests.length > 0 && (
        <section aria-labelledby="tests" className="flex flex-col gap-3">
          <h2 id="tests" className="text-xl font-semibold">
            Blood tests
          </h2>
          {today.tests.map((t) => (
            <div key={t.item.id} className="flex flex-col gap-2 rounded-2xl border border-ink/30 p-4">
              <p className="text-xl font-semibold">{t.item.product}</p>
              <p className="text-base">{describePlanItem(plan.items.find((i) => i.id === t.item.id)!)}</p>
              {t.upcoming === null ? (
                <p className="text-lg">The dates show once an injection is logged.</p>
              ) : t.upcoming.length === 0 ? (
                <p className="text-lg">No more tests in this cycle. The next dates show once the next injection is logged.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {t.upcoming.map((d) => (
                    <li key={d.day} className="text-lg">
                      Around day {d.day}: {formatDate(d.dueOn)}
                      {d.daysUntil === 0 ? ", today" : `, in ${d.daysUntil} day${d.daysUntil === 1 ? "" : "s"}`}.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
