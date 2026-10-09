import type { Metadata } from "next";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { requireOwner } from "@/lib/auth/session";
import { signOut } from "../../sign-in/actions";
import { TabPage } from "../_components/tab-page";

export const metadata: Metadata = { title: "Dog · Tailhelm" };

export default function DogPage() {
  return (
    <TabPage tab={TABS[3]}>
      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </TabPage>
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
