import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { formatDate } from "@/lib/plan/input";
import { createClient } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today/queries";
import { stopCalendarLink } from "./actions";
import { CalendarLink } from "./calendar-link";

export const metadata: Metadata = { title: "Reminders · Tailhelm" };

const quietLink = "min-h-12 text-lg text-green underline underline-offset-4";

export default function RemindersPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold">Reminders</h1>
      <Suspense fallback={<p className="text-lg">Loading…</p>}>
        <Calendar />
      </Suspense>
    </main>
  );
}

async function Calendar() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  if (!dog) {
    return (
      <p className="text-lg">
        <Link href="/dog" className={quietLink}>
          Add your dog and their plan
        </Link>{" "}
        first.
      </p>
    );
  }
  const supabase = await createClient();
  const [{ data: feed }, timeZone] = await Promise.all([
    supabase
      .from("calendar_feeds")
      .select("created_at, last_fetched_at")
      .eq("dog_id", dog.id)
      .is("revoked_at", null)
      .maybeSingle<{ created_at: string; last_fetched_at: string | null }>(),
    getTimeZone(owner.userId),
  ]);
  const when = (at: string) => {
    const l = toLocal(new Date(at), timeZone);
    return `${formatDate(l.date)} at ${l.time}`;
  };

  return (
    <section aria-labelledby="calendar" className="flex flex-col gap-4">
      <h2 id="calendar" className="text-xl font-semibold">
        Your calendar
      </h2>
      <p className="text-lg">
        Subscribe your phone&rsquo;s calendar to {dog.name}&rsquo;s plan. Each daily dose, the next injection and
        each blood test then appear there with an alarm, even when Tailhelm is closed or offline. The calendar
        shows medicine names and times, never a dose.
      </p>
      {feed ? (
        <p className="text-lg">
          Link made on {when(feed.created_at)}.{" "}
          {feed.last_fetched_at
            ? `Your calendar last read it on ${when(feed.last_fetched_at)}.`
            : "No calendar has read it yet."}
        </p>
      ) : (
        <p className="text-lg">No calendar link yet.</p>
      )}
      <CalendarLink dogId={dog.id} hasLive={!!feed} />
      {feed && (
        <form action={stopCalendarLink}>
          <input type="hidden" name="dog_id" value={dog.id} />
          <button type="submit" className={quietLink}>
            Stop the link (calendars empty on their next refresh)
          </button>
        </form>
      )}
      <p className="text-base">
        Tailhelm is a backup to your own routine. It is not a medical device and it does not replace your
        vet&rsquo;s instructions or your own checks. Reminders can fail: phones, calendars and email all fail
        sometimes. Always follow your vet&rsquo;s plan, keep your own routine, and call your vet if a dose is
        missed or you are worried.
      </p>
    </section>
  );
}
