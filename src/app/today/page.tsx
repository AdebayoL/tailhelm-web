import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { signOut } from "../sign-in/actions";

export const metadata: Metadata = { title: "Today · Tailhelm" };

export default function TodayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-4xl font-semibold text-green">Today</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <SignedIn />
      </Suspense>
    </main>
  );
}

async function SignedIn() {
  const owner = await requireOwner();
  return (
    <>
      <p className="text-lg">Signed in as {owner.email ?? "you"}.</p>
      <form action={signOut}>
        <button type="submit" className="text-green underline underline-offset-4">
          Sign out
        </button>
      </form>
    </>
  );
}
