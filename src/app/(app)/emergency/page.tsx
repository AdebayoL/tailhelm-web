import type { Metadata } from "next";
import Link from "next/link";
import { OwnerOnly } from "../_components/owner-only";

export const metadata: Metadata = { title: "Emergency · Tailhelm" };

/**
 * Reachable in one tap from every screen and built for the 3 a.m. rule: no
 * typing, no choices, large targets. The vet's numbers and the crisis
 * checklist appear here once they exist; the checklist comes only from an
 * attested condition pack.
 */
export default function EmergencyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <OwnerOnly />
      <h1 className="text-4xl font-semibold text-alert-red">Emergency</h1>
      <p className="text-3xl font-semibold leading-tight">Call your vet now.</p>
      <p className="text-lg">
        Your vet&rsquo;s number and the out-of-hours number will show here as call buttons once you add them to
        your dog&rsquo;s profile.
      </p>
      <Link
        href="/dog"
        className="flex min-h-[72px] items-center justify-center rounded-2xl border-2 border-green px-6 text-xl font-semibold text-green"
      >
        Add your vet&rsquo;s numbers
      </Link>
    </main>
  );
}
