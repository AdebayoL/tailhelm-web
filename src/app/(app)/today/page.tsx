import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { telHref } from "@/lib/dogs/input";
import { describePlanItem, formatDate } from "@/lib/plan/input";
import { getTodayData } from "@/lib/today/queries";
import { buildToday, nextActionText } from "@/lib/today/today";
import { TabPage } from "../_components/tab-page";
import { DoseTick } from "./dose-tick";

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
                <p className="text-base">{describePlanItem(plan.items.find((i) => i.id === d.item.id)!)}</p>
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
          {today.countdowns.map((c) => (
            <p key={c.item.id} className="text-lg">
              {c.dueOn === null
                ? `${c.item.product}: the next date shows once the last injection is logged.`
                : c.daysUntil! < 0
                  ? `${c.item.product}: was due on ${formatDate(c.dueOn)}.`
                  : c.daysUntil === 0
                    ? `${c.item.product}: due today.`
                    : `${c.item.product}: due on ${formatDate(c.dueOn)}, in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}.`}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
