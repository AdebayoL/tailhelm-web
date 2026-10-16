import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { SheetClose, SheetLink } from "@/app/_components/sheet-link";
import { addDays, toLocal } from "@/engine/time";
import { dayMonth, monthYear, weekdayDate } from "@/lib/app/dates";
import { jewelClass } from "@/lib/app/jewel";
import { MORE } from "@/lib/app/nav";
import { initial } from "@/lib/app/words";
import { requireOwner } from "@/lib/auth/session";
import { hoursLines } from "@/lib/dogs/hours";
import { type Dog, getMyDog } from "@/lib/dogs/queries";
import { getMyName } from "@/lib/household/queries";
import { describePlanItem, formatDate, planLine, planOptions, scheduleTimes } from "@/lib/plan/input";
import { type PlanItem, getDogPlan } from "@/lib/plan/queries";
import { getResults } from "@/lib/results/queries";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { type InjectionInfo, getInjectionInfo } from "@/lib/treatments/queries";
import { WEIGHT_TYPE, vetWeight } from "@/lib/weight/input";
import { conditionName } from "@/packs/names";
import { getPack } from "@/packs/registry";
import { Page } from "../../_components/page";
import { NameForm } from "../care-team/forms";
import { ConditionForm } from "./condition-form";
import { DogProfileForm } from "./dog-profile-form";
import { PlanItemForm } from "./plan-item-form";
import { RetireButton } from "./retire-button";
import { SignOutButton } from "./sign-out-button";
import { VetsForm } from "./vets-form";

export const metadata: Metadata = { title: "Dog · Tailhelm" };

const CONDITION_KEY = "addisons";

export default function DogPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <DogContent />
    </Suspense>
  );
}

async function DogContent() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  if (!dog) {
    return (
      <Page title="Add your dog" sub="Profile, vets and care plan">
        <section className="card lg stack-24" aria-label="Your dog">
          <div className="stack-8">
            <h2 className="r-t">Start with their name</h2>
            <p className="hint">You can add their vets and care plan next. If someone invited you to help care for their dog, accept on Care team.</p>
          </div>
          <DogProfileForm dog={null} />
        </section>
        <Account email={owner.email} userId={owner.userId} />
      </Page>
    );
  }

  const [plan, names, timeZone] = await Promise.all([getDogPlan(dog.id), householdNames(dog.id), getTimeZone(owner.userId)]);
  const today = toLocal(new Date(), timeZone).date;
  const items = plan?.items ?? [];
  const [weights, injections] = await Promise.all([
    plan ? getResults(plan.condition.id, [WEIGHT_TYPE], 20) : Promise.resolve([]),
    getInjectionInfo(items.filter((i) => i.schedule_json.kind === "interval").map((i) => i.id)),
  ]);
  const weight = vetWeight(
    weights.map((w) => ({ kg: w.values_json.kg, scale: w.scale, on: toLocal(new Date(w.taken_at), timeZone).date })),
    formatDate,
  );
  const who = (profile: string | null) => (profile && names[profile]) || "someone in the household";
  const avatar = (
    <span className="avatar lg" aria-hidden="true">
      {initial(dog.name)}
    </span>
  );

  return (
    <Page
      title={dog.name}
      sub={<span className="d-only">Profile, vets and care plan · {weekdayDate(today)}</span>}
      lead={avatar}
      dog
      space={16}
      band="overlap"
    >
      {/* On a phone the Dog tab is the way to its other screens; a desktop lists them in the sidebar. */}
      <nav className="card m-only" aria-label="More for your dog" style={{ padding: "4px 20px" }}>
        <ul>
          {MORE.map((m, i) => (
            <li key={m.href} style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
              <Link href={m.href} className="lnk" style={{ width: "100%", textDecoration: "none", gap: 12 }}>
                <Icon name={m.icon} />
                <span style={{ flex: 1 }}>{m.label}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="d-row">
        <section className="card lg stack-16" aria-label="Profile" style={{ flex: "5 1 380px" }}>
          <div className="kicker">
            <span>Profile</span>
            <SheetLink label="Edit" title="Edit profile" icon="edit">
              <DogProfileForm dog={dog} />
            </SheetLink>
          </div>
          <dl className="dl wide" style={{ rowGap: 12 }}>
            <dt>Condition</dt>
            <dd>
              {plan ? conditionName(plan.condition.condition_key) : <span className="c2">Not added yet</span>}
              {plan?.condition.diagnosed_on && (
                <>
                  {" "}
                  <span className="c2 nowrap">(diagnosed {formatDate(plan.condition.diagnosed_on)})</span>
                </>
              )}
            </dd>
            {dog.breed && (
              <>
                <dt>Breed</dt>
                <dd>{dog.breed}</dd>
              </>
            )}
            {dog.date_of_birth && (
              <>
                <dt>Born</dt>
                <dd>{monthYear(dog.date_of_birth)}</dd>
              </>
            )}
            {weight && (
              <>
                <dt>Weight</dt>
                <dd>
                  {weight.kg} <span className="c2">{weight.where}</span>
                </dd>
              </>
            )}
          </dl>
        </section>

        <Vets dog={dog} />
      </div>

      {plan ? (
        <div className="d-row" style={{ alignItems: "flex-start" }}>
          <CarePlan items={items} injections={injections} who={who} />
          <section className="card lg stack-24" aria-label="Add a medicine" style={{ flex: "5 1 400px" }}>
            <div className="stack-8">
              <h2 className="r-t">Add a medicine</h2>
              <p className="hint">
                Type it exactly as your vet wrote it, on the label or in their notes. Tailhelm never works out, checks or
                changes a dose.
              </p>
            </div>
            <PlanItemForm
              conditionId={plan.condition.id}
              options={planOptions(plan.condition.condition_key, plan.condition.variant)}
              activeItems={items.map((item) => ({ id: item.id, pack_key: item.pack_key, label: describePlanItem(item) }))}
            />
          </section>
        </div>
      ) : (
        <AddCondition dog={dog} />
      )}

      <Account email={owner.email} userId={owner.userId} />
    </Page>
  );
}

function Vets({ dog }: { dog: Dog }) {
  const any = dog.vet_name || dog.vet_phone || dog.out_of_hours_phone || dog.out_of_hours_name;
  const hours = dog.vet_hours || dog.out_of_hours_hours;
  return (
    <section className="card lg stack-20" aria-label="Vets" style={{ flex: "7 1 520px" }}>
      <div className="kicker">
        <span>Vets</span>
        <SheetLink label={any ? "Edit" : "Add"} title="Vets" icon={any ? "edit" : "add"}>
          <VetsForm dog={dog} />
        </SheetLink>
      </div>
      {any ? (
        <div className="vets-grid">
          <div className="stack-8">
            <p className="ty-label c2">Your vet</p>
            <p className="r-t">{dog.vet_name ?? "Your vet"}</p>
            <dl className="dl">
              <dt>Phone</dt>
              <dd>{dog.vet_phone ?? <span className="c2">Not added</span>}</dd>
              {dog.vet_hours && (
                <>
                  <dt>Hours</dt>
                  <dd>
                    {hoursLines(dog.vet_hours).map((line, i) => (
                      <span key={line}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="stack-8">
            <p className="ty-label c2">Out of hours</p>
            <p className="r-t">{dog.out_of_hours_name ?? "Out-of-hours vet"}</p>
            <dl className="dl">
              <dt>Phone</dt>
              <dd>{dog.out_of_hours_phone ?? <span className="c2">Not added</span>}</dd>
              {dog.out_of_hours_hours && (
                <>
                  <dt>Hours</dt>
                  <dd>
                    {hoursLines(dog.out_of_hours_hours).map((line, i) => (
                      <span key={line}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      ) : (
        <p>Add your vet&rsquo;s number and the out-of-hours number, and they show on Emergency as call buttons.</p>
      )}
      <p className="prov" style={{ marginTop: "auto" }}>
        {hours ? "Emergency uses these hours to choose who to call first." : "Add opening hours, and Emergency uses them to choose who to call first."}
      </p>
    </section>
  );
}

/** What each row says beside the medicine: its times, when it is next due, or when it shows. */
function rowFacts(item: PlanItem, injection: InjectionInfo | undefined, who: (p: string | null) => string) {
  const s = item.schedule_json;
  const entered = `entered by ${who(item.created_by)}`;
  const last = injection?.last;
  const lastText = last && `last given ${dayMonth(last.given_on)} by ${last.given_by ?? who(last.given_by_profile)}`;
  switch (s.kind) {
    case "fixed":
      return { phone: `Reminders ${scheduleTimes(s.times)} · ${entered}`, desk: `Entered by ${who(item.created_by)}`, schedule: scheduleTimes(s.times) };
    case "interval": {
      const next = last ? `Next ${dayMonth(addDays(last.given_on, s.everyDays))}` : "Not given yet";
      return {
        phone: [next, lastText].filter(Boolean).join(" · "),
        desk: lastText ? lastText.charAt(0).toUpperCase() + lastText.slice(1) : `Entered by ${who(item.created_by)}`,
        schedule: next,
      };
    }
    case "event":
      return { phone: "Shown with stressful days on Today", desk: `Entered by ${who(item.created_by)}`, schedule: "On stressful days" };
    case "offset":
      return { phone: `Reminder ${s.time} · ${entered}`, desk: `Entered by ${who(item.created_by)}`, schedule: "After each injection" };
    default:
      return { phone: entered.charAt(0).toUpperCase() + entered.slice(1), desk: `Entered by ${who(item.created_by)}`, schedule: "" };
  }
}

function CarePlan({
  items,
  injections,
  who,
}: {
  items: PlanItem[];
  injections: Record<string, InjectionInfo>;
  who: (p: string | null) => string;
}) {
  // Daily medicines first, then injections and the tests timed from them, then the stressful-day plan.
  const rank = { fixed: 0, interval: 1, offset: 2, series: 3, event: 4 } as const;
  const sorted = [...items].sort((a, b) => rank[a.schedule_json.kind] - rank[b.schedule_json.kind]);
  return (
    <section className="plan-card" aria-label="Care plan" style={{ flex: "7 1 520px" }}>
      <div className="sec-h">
        <h2 className="r-t">Care plan</h2>
        <span className="sec-meta">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <p className="hint">Exactly as you entered it from your vet&rsquo;s instructions. Tailhelm never works out or changes a dose.</p>
      {items.length === 0 ? (
        <p>Nothing on the plan yet. Add each medicine as your vet prescribed it.</p>
      ) : (
        <div className="plan-rows">
          <div className="plan-head ty-label c2 d-only">
            <span>Medicine and dose, as entered</span>
            <span>Schedule</span>
            <span />
          </div>
          <ol className="recs">
            {sorted.map((item) => {
              const line = planLine(item);
              const facts = rowFacts(item, injections[item.id], who);
              const last = injections[item.id]?.last;
              return (
                <li key={item.id}>
                  <SheetLink
                    label={line.name}
                    className="plan-row"
                    trigger={
                      <>
                        <span className="stack-4">
                          <span className="tn" style={{ textWrap: "pretty" }}>
                            <b className={`w6 ${jewelClass(item.schedule_json)}`}>{line.name}</b> {line.rest}
                            {line.set && (
                              <>
                                {" "}
                                <span className="c2 nowrap">{line.set}</span>
                              </>
                            )}
                          </span>
                          <span className="prov m-only">{facts.phone}</span>
                          <span className="prov d-only">{facts.desk}</span>
                        </span>
                        <span className="tn sched">{facts.schedule}</span>
                        <Icon name="open" className="c2" />
                      </>
                    }
                  >
                    <p className="ty-lead tn">{describePlanItem(item)}</p>
                    {item.vet_instructions && (
                      <div className="panel stack-4">
                        <p className="ty-label c2">Your vet&rsquo;s {item.schedule_json.kind === "event" ? "plan" : "instructions"}, as entered</p>
                        <p style={{ whiteSpace: "pre-line" }}>{item.vet_instructions}</p>
                      </div>
                    )}
                    <dl className="dl wide">
                      <dt>Entered by</dt>
                      <dd>{who(item.created_by)}</dd>
                      {last && (
                        <>
                          <dt>Last given</dt>
                          <dd>
                            {formatDate(last.given_on)} by {last.given_by ?? who(last.given_by_profile)}
                          </dd>
                        </>
                      )}
                      {last && item.schedule_json.kind === "interval" && (
                        <>
                          <dt>Next due</dt>
                          <dd>{formatDate(addDays(last.given_on, item.schedule_json.everyDays))}</dd>
                        </>
                      )}
                    </dl>
                    <p className="hint">
                      When your vet changes it, add it again with the new date they set it. What was there before stays in the
                      history.
                    </p>
                    <RetireButton planItemId={item.id} />
                    <SheetClose />
                  </SheetLink>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

function AddCondition({ dog }: { dog: Dog }) {
  const pack = getPack(CONDITION_KEY);
  if (!pack) return null;
  const name = conditionName(pack.condition);
  const variants = pack.variants.map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    definition: pack.definitions.find((d) => d.key === key)?.text ?? null,
  }));
  return (
    <section className="card lg stack-24" aria-label="Condition" style={{ maxWidth: 720 }}>
      <div className="stack-8">
        <h2 className="r-t">{dog.name}&rsquo;s condition</h2>
        <p className="hint">Then add each medicine exactly as your vet prescribed it.</p>
      </div>
      <ConditionForm dogId={dog.id} conditionKey={pack.condition} conditionName={name} variants={variants} />
    </section>
  );
}

/** Signing out, and the free download of everything Tailhelm holds. */
async function Account({ email, userId }: { email: string | null; userId: string }) {
  const name = await getMyName(userId);
  return (
    <section className="card lg stack-16" aria-label="Your account" style={{ maxWidth: 720 }}>
      <div className="kicker">
        <span>Your account</span>
        <SheetLink label="Edit" title="Your name" icon="edit">
          <NameForm name={name} />
        </SheetLink>
      </div>
      <dl className="dl">
        <dt>Name</dt>
        <dd>{name ?? "Not set"}</dd>
        <dt>Email</dt>
        <dd style={{ overflowWrap: "anywhere" }}>{email ?? "Not set"}</dd>
      </dl>
      <div className="stack-4">
        <p className="w6">Your records</p>
        <p className="hint">Everything Tailhelm holds about your dogs, as one spreadsheet file. Free on every plan.</p>
        {/* A plain link: the file downloads, so there is no page to prefetch. */}
        <a href="/dog/export" download className="lnk" style={{ alignSelf: "flex-start" }}>
          Download all records (CSV)
        </a>
      </div>
      <hr className="hr" />
      <SignOutButton />
    </section>
  );
}
