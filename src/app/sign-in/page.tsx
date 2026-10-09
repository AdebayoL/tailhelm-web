import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/lib/auth/input";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Tailhelm" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-4xl font-semibold text-green">Sign in to Tailhelm</h1>
      <p className="text-lg">
        We&rsquo;ll send a 6-digit code. No password. The free plan includes the emergency card, all
        reminders and crisis alerts.
      </p>
      <Suspense fallback={<SignInForm next="/today" />}>
        <FormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithNext({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(Array.isArray(next) ? next[0] : next)} />;
}
