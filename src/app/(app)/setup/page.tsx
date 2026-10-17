import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { Wordmark } from "@/app/_components/mark";
import { ACKNOWLEDGEMENT } from "@/lib/app/acknowledgement";
import { getMyDog } from "@/lib/dogs/queries";
import { getDogPlan } from "@/lib/plan/queries";
import { vapidPublicKey } from "@/lib/push/config";
import { parseStep } from "@/lib/setup/steps";
import { createClient } from "@/lib/supabase/server";
import { AddCalendar, CopyCalendarLink } from "../(main)/reminders/calendar-link";
import { EmergencyButton } from "../_components/emergency-button";
import { OwnerOnly } from "../_components/owner-only";
import { acknowledge } from "./actions";
import { CalendarNext, HomeStep, NotificationsStep, StepHead, TestStep } from "./steps";

export const metadata: Metadata = { title: "Set up · Tailhelm" };

/**
 * The setup every person goes through before the app opens, one step to a
 * screen (Build Spec, "Reminders"). Each step is in the address, so coming
 * back from the calendar app or the Home Screen lands on the same step.
 */
export default function SetupPage({ searchParams }: PageProps<"/setup">) {
  return (
    <div className="auth setup">
      <OwnerOnly />
      <aside className="auth-side ink lit">
        <div className="row between gap-12">
          <span className="wm" aria-label="Tailhelm">
            <Wordmark size={32} textStyle={{ fontSize: 26, lineHeight: "32px" }} />
          </span>
          <EmergencyButton />
        </div>
        <div className="stack-16 auth-promise d-only">
          <p className="auth-promise-h">Four ways to be reminded.</p>
          <p className="auth-promise-sub c2">Your calendar, notifications on your phone, email, and the rest of your household. If one fails, the others are still there.</p>
        </div>
        <p className="prov auth-disclaimer d-only">Tailhelm is a backup to your own routine. It is not a medical device.</p>
      </aside>
      <main className="auth-main">
        <Suspense fallback={<div className="stack-24 auth-form" aria-busy="true" />}>
          <Step searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Step({ searchParams }: Pick<PageProps<"/setup">, "searchParams">) {
  const params = await searchParams;
  const step = parseStep(params.step);
  const dog = await getMyDog();
  if (!dog) redirect("/dog");

  return (
    <div className="stack-24 auth-form">
      <StepHead step={step} />
      {step === "home" && <HomeStep />}
      {step === "notifications" && <NotificationsStep publicKey={vapidPublicKey()} />}
      {step === "calendar" && <CalendarStep dogId={dog.id} dogName={dog.name} />}
      {step === "test" && <TestStep />}
      {step === "acknowledge" && <AcknowledgeStep missing={params.missing === "1"} failed={params.failed === "1"} />}
    </div>
  );
}

const APP_NAMES = { apple: "Apple Calendar", google: "Google Calendar", other: "your calendar" } as const;

async function CalendarStep({ dogId, dogName }: { dogId: string; dogName: string }) {
  const supabase = await createClient();
  const [{ data }, plan] = await Promise.all([
    supabase.from("calendar_feeds").select("app").eq("dog_id", dogId).is("revoked_at", null),
    getDogPlan(dogId),
  ]);
  const apps = ((data ?? []) as { app: "apple" | "google" | "other" }[]).map((f) => f.app);
  const has = (app: "apple" | "google" | "other") => apps.includes(app);
  const timed = (plan?.items.length ?? 0) > 0;
  return (
    <>
      <div className="stack-8">
        <h1 className="auth-title">Add the plan to your calendar</h1>
        <p className="ty-lead c2">
          Your calendar&rsquo;s alarms remind you at each dose time for {dogName}, even when a notification doesn&rsquo;t arrive. It shows
          medicine names and times, never a dose.
        </p>
      </div>
      <div className="stack-12">
        {(["apple", "google"] as const).map((app) => (
          <div key={app} className="cal-app">
            <div className="row between gap-12">
              <p className="cal-name">{APP_NAMES[app]}</p>
              {has(app) && (
                <span className="chip chip-rec">
                  <Icon name="tick" size={16} />
                  Added
                </span>
              )}
            </div>
            <AddCalendar dogId={dogId} app={app} linked={has(app)} />
          </div>
        ))}
        <CopyCalendarLink dogId={dogId} hasLive={has("other")} />
        {has("other") && <p className="prov">A copied link is made. Paste it into Outlook or your calendar to subscribe.</p>}
      </div>
      {apps.length > 0 && (
        <p className="hint">
          Open {APP_NAMES[apps[0]]} once so it subscribes. Calendars refresh on their own schedule, so the plan can take a while to show
          there.
        </p>
      )}
      {!timed && <p className="hint">Nothing on the care plan has a reminder time yet. The calendar fills in as you add it.</p>}
      <CalendarNext linked={apps.length > 0} />
    </>
  );
}

function AcknowledgeStep({ missing, failed }: { missing: boolean; failed: boolean }) {
  return (
    <form action={acknowledge} className="stack-24">
      <div className="stack-8">
        <h1 className="auth-title">Before you start</h1>
        <p className="ty-lead c2">Please read this and tick the box.</p>
      </div>
      <div className="panel">
        <p>{ACKNOWLEDGEMENT.text}</p>
      </div>
      <label className="check">
        <input className="sr" type="checkbox" name="agree" value="yes" required aria-describedby={missing ? "agree-error" : undefined} />
        <span className="box">
          <Icon name="boxTick" />
        </span>
        <span className="check-text">I understand that Tailhelm is a backup to my own routine and that reminders can fail.</span>
      </label>
      {missing && (
        <p className="err" id="agree-error" role="alert">
          <Icon name="attention" />
          Tick the box to finish setup.
        </p>
      )}
      {failed && (
        <p className="err" role="alert">
          <Icon name="attention" />
          That wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Finish setup
      </button>
    </form>
  );
}
