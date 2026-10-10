import type { Metadata } from "next";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { describePlanItem, formatDate, planOptions } from "@/lib/plan/input";
import { getDogPlan } from "@/lib/plan/queries";
import { CONDITION_NAMES } from "@/packs/pack-sql";
import { getPack } from "@/packs/registry";
import { signOut } from "../../sign-in/actions";
import { TabPage } from "../_components/tab-page";
import { ConditionForm } from "./condition-form";
import { DogProfileForm } from "./dog-profile-form";
import { PlanItemForm } from "./plan-item-form";
import { RetireButton } from "./retire-button";

export const metadata: Metadata = { title: "Dog · Tailhelm" };

export default function DogPage() {
  return (
    <TabPage tab={TABS[3]}>
      <Suspense fallback={<p>Loading…</p>}>
        <Profile />
      </Suspense>
      <Suspense fallback={null}>
        <Plan />
      </Suspense>
      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </TabPage>
  );
}

async function Profile() {
  await requireOwner();
  const dog = await getMyDog();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{dog ? dog.name : "Add your dog"}</h2>
      <DogProfileForm dog={dog} />
    </section>
  );
}

const CONDITION_KEY = "addisons";

/** The condition and the medicines exactly as the vet prescribed them. */
async function Plan() {
  await requireOwner();
  const dog = await getMyDog();
  if (!dog) return null;
  const plan = await getDogPlan(dog.id);
  const pack = getPack(plan?.condition.condition_key ?? CONDITION_KEY);
  if (!pack) return null;
  const conditionName = CONDITION_NAMES[pack.condition] ?? pack.condition;

  if (!plan) {
    const variants = pack.variants.map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      definition: pack.definitions.find((d) => d.key === key)?.text ?? null,
    }));
    return (
      <section className="flex flex-col gap-4 border-t border-sand pt-6">
        <h2 className="text-xl font-semibold">{dog.name}&rsquo;s condition</h2>
        <ConditionForm dogId={dog.id} conditionKey={pack.condition} conditionName={conditionName} variants={variants} />
      </section>
    );
  }

  const { condition, items } = plan;
  const labelled = items.map((item) => ({ item, label: describePlanItem(item) }));
  const options = planOptions(condition.condition_key, condition.variant);

  return (
    <section className="flex flex-col gap-4 border-t border-sand pt-6">
      <h2 className="text-xl font-semibold">{dog.name}&rsquo;s plan</h2>
      <p className="text-lg">
        {conditionName}
        {condition.variant && `, ${condition.variant}`}
        {condition.diagnosed_on && `, diagnosed ${formatDate(condition.diagnosed_on)}`}.
      </p>
      {labelled.length === 0 ? (
        <p className="text-lg">Nothing on the plan yet. Add each medicine as your vet prescribed it.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {labelled.map(({ item, label }) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-ink/30 px-4 py-3">
              <p className="text-lg">{label}</p>
              {item.vet_instructions && <p className="text-base">Your vet&rsquo;s instructions: {item.vet_instructions}</p>}
              <RetireButton planItemId={item.id} />
            </li>
          ))}
        </ul>
      )}
      <h3 className="pt-2 text-lg font-semibold">Add to the plan</h3>
      <p className="text-base">Enter each medicine or test exactly as your vet set it. To change something, add it again with the new date.</p>
      <PlanItemForm
        conditionId={condition.id}
        options={options}
        activeItems={labelled.map(({ item, label }) => ({ id: item.id, pack_key: item.pack_key, label }))}
      />
    </section>
  );
}

async function Account() {
  const owner = await requireOwner();
  return (
    <section className="flex flex-col gap-2 border-t border-sand pt-6">
      <h2 className="text-xl font-semibold">Your account</h2>
      <p className="text-lg">Signed in as {owner.email ?? "you"}.</p>
      <form action={signOut}>
        <button type="submit" className="min-h-12 text-lg text-green underline underline-offset-4">
          Sign out
        </button>
      </form>
    </section>
  );
}
