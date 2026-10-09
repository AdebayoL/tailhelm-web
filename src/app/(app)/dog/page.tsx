import type { Metadata } from "next";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { signOut } from "../../sign-in/actions";
import { TabPage } from "../_components/tab-page";
import { DogProfileForm } from "./dog-profile-form";

export const metadata: Metadata = { title: "Dog · Tailhelm" };

export default function DogPage() {
  return (
    <TabPage tab={TABS[3]}>
      <Suspense fallback={<p>Loading…</p>}>
        <Profile />
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
