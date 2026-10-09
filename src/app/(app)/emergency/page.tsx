import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";
import { telHref } from "@/lib/dogs/input";
import { getMyDog } from "@/lib/dogs/queries";

export const metadata: Metadata = { title: "Emergency · Tailhelm" };

const callButton =
  "flex min-h-[72px] items-center justify-center rounded-2xl bg-emergency px-6 text-center text-xl font-semibold text-white";
const quietButton =
  "flex min-h-[72px] items-center justify-center rounded-2xl border-2 border-green px-6 text-center text-xl font-semibold text-green";

/**
 * Reachable in one tap from every screen and built for the 3 a.m. rule: no
 * typing, no choices, large targets. The crisis checklist will appear here
 * only from an attested condition pack.
 */
export default function EmergencyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-4xl font-semibold text-alert-red">Emergency</h1>
      <p className="text-3xl font-semibold leading-tight">Call your vet now.</p>
      <Suspense fallback={null}>
        <CallButtons />
      </Suspense>
    </main>
  );
}

async function CallButtons() {
  await requireOwner();
  const dog = await getMyDog();
  const vet = dog?.vet_phone;
  const outOfHours = dog?.out_of_hours_phone;

  if (!vet && !outOfHours) {
    return (
      <>
        <p className="text-lg">
          Your vet&rsquo;s number and the out-of-hours number will show here as call buttons once you add them to
          your dog&rsquo;s profile.
        </p>
        <Link href="/dog" className={quietButton}>
          Add your vet&rsquo;s numbers
        </Link>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {vet && (
        <a href={telHref(vet)} className={callButton}>
          Call {dog?.vet_name ?? "your vet"} · {vet}
        </a>
      )}
      {outOfHours && (
        <a href={telHref(outOfHours)} className={callButton}>
          Call out of hours · {outOfHours}
        </a>
      )}
    </div>
  );
}
