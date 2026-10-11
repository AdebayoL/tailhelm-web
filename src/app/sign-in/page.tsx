import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/app/_components/mark";
import { safeNext } from "@/lib/auth/input";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Tailhelm" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const side = (
    <aside className="auth-side">
      <Link className="wm" href="/" aria-label="Tailhelm home">
        <Wordmark size={32} textStyle={{ fontSize: 26, lineHeight: "32px" }} />
      </Link>
      <div className="stack-16 auth-promise d-only">
        <p className="auth-promise-h">For dogs who can&rsquo;t miss a dose.</p>
        <p className="auth-promise-sub c2">The care log for dogs with lifelong conditions, starting with Addison&rsquo;s disease.</p>
      </div>
      <p className="prov auth-disclaimer d-only">
        Tailhelm is a record of what your household enters. It doesn&rsquo;t give medical advice and isn&rsquo;t part of any veterinary
        practice.
      </p>
    </aside>
  );
  return (
    <Suspense fallback={<SignInForm next="/today" side={side} />}>
      <FormWithNext searchParams={searchParams} side={side} />
    </Suspense>
  );
}

async function FormWithNext({ searchParams, side }: Pick<PageProps<"/sign-in">, "searchParams"> & { side: React.ReactNode }) {
  const { next } = await searchParams;
  return <SignInForm next={safeNext(Array.isArray(next) ? next[0] : next)} side={side} />;
}
