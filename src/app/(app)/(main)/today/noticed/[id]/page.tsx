import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { dogHasPlus } from "@/lib/history/queries";
import { historyStart } from "@/lib/history/window";
import { getNoticedOne, noticedOn } from "@/lib/noticed/queries";
import { noticedDate, noticedVisible } from "@/lib/noticed/view";
import { getTimeZone } from "@/lib/today/queries";
import { Page } from "../../../../_components/page";
import { NoticedDetail } from "../detail";

export const metadata: Metadata = { title: "Noticed · Tailhelm" };

/**
 * One observation, and why it was shown: the rule and its threshold, what it
 * reads, and the exact records behind it, so the owner can check it and show
 * it to their vet.
 */
export default function NoticedPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <Noticed params={params} />
    </Suspense>
  );
}

async function Noticed({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, owner, dog] = await Promise.all([params, requireOwner(), getMyDog()]);
  const [row, timeZone] = await Promise.all([getNoticedOne(id), getTimeZone(owner.userId)]);
  const today = toLocal(new Date(), timeZone).date;
  const [on, plus] = dog ? await Promise.all([noticedOn(dog.id), dogHasPlus(dog.id)]) : [false, false];
  if (!row || !dog || row.dog_id !== dog.id || !on || !noticedVisible(row, historyStart(today, plus))) {
    return (
      <Page title="Noticed" space={24}>
        <div className="panel stack-12" role="status">
          <p className="ty-section">This observation can&rsquo;t be shown.</p>
          <p className="c2">Noticed may be switched off. Anyone in the household can switch it on from the Dog tab.</p>
        </div>
        <Link className="btn btn-secondary" href="/today">
          Back to Today
        </Link>
      </Page>
    );
  }
  return (
    <Page title="Noticed" sub={<span className="d-only">{dog.name} · {noticedDate(row.computed_on, today)}</span>} space={24}>
      <NoticedDetail dog={dog} row={row} today={today} />
    </Page>
  );
}
