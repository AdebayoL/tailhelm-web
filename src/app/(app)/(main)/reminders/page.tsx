import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { addDays, toLocal } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { getShell } from "@/lib/app/shell";
import { formatDate } from "@/lib/plan/input";
import { reminderTimes } from "@/lib/reminders/times";
import { createClient } from "@/lib/supabase/server";
import { getTodayData } from "@/lib/today/queries";
import { buildToday } from "@/lib/today/today";
import { Page } from "../../_components/page";
import { requireOwner } from "@/lib/auth/session";
import { emailConfig } from "@/lib/email/send";
import { setEmailReminders, stopCalendarLink } from "./actions";
import { AddCalendar, CopyCalendarLink } from "./calendar-link";
import { HomeScreenCheck } from "./home-screen";
import { PhoneNotifications } from "./notifications";
import { vapidPublicKey } from "@/lib/push/config";

export const metadata: Metadata = { title: "Reminders · Tailhelm" };

export default function RemindersPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <Reminders />
    </Suspense>
  );
}

type Feed = { app: "apple" | "google" | "other"; created_at: string; created_by: string | null; last_fetched_at: string | null };

const APP_NAMES = { apple: "Apple Calendar", google: "Google Calendar" } as const;
const FETCHER = { apple: "Apple", google: "Google", other: "your calendar" } as const;

async function Reminders() {
  const [data, shell] = await Promise.all([getTodayData(), getShell()]);
  if (!data) {
    return (
      <Page title="Reminders">
        <section className="card lg stack-16" aria-label="Nothing to remind yet">
          <h2 className="r-t">Add your dog first</h2>
          <p>Reminders follow your dog&rsquo;s care plan, as you enter it from your vet&rsquo;s instructions.</p>
          <Link href="/dog" className="btn btn-primary" style={{ alignSelf: "flex-start", width: "auto" }}>
            Go to Dog
          </Link>
        </section>
      </Page>
    );
  }

  const { dog, input } = data;
  const today = buildToday(input);
  const supabase = await createClient();
  const publicKey = vapidPublicKey();
  const emailReady = !!emailConfig();
  const owner = await requireOwner();
  const [{ data: feedRows }, { data: lastSentRow }, { data: me }, { data: lastEmailRow }] = await Promise.all([
    supabase.from("calendar_feeds").select("app, created_at, created_by, last_fetched_at").eq("dog_id", dog.id).is("revoked_at", null),
    supabase
      .from("notifications")
      .select("sent_at")
      .eq("status", "sent")
      .eq("channel", "push")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ sent_at: string }>(),
    supabase.from("profiles").select("email, email_reminders").eq("id", owner.userId).maybeSingle<{ email: string; email_reminders: boolean }>(),
    supabase
      .from("notifications")
      .select("sent_at")
      .eq("status", "sent")
      .eq("channel", "email")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ sent_at: string }>(),
  ]);
  const emailOn = me?.email_reminders ?? true;
  const feeds = (feedRows ?? []) as Feed[];
  const feed = (app: Feed["app"]) => feeds.find((f) => f.app === app);
  const local = (at: string) => toLocal(new Date(at), input.timeZone);
  const atText = (at: string) => {
    const l = local(at);
    return `${l.time} ${l.date === today.date ? "today" : l.date === addDays(today.date, -1) ? "yesterday" : `on ${dayMonth(l.date)}`}`;
  };
  const who = (profile: string | null) => (profile && input.names[profile]) || "someone in the household";
  const rows = reminderTimes(data.plan?.items ?? [], today);
  const soundTimes = [...new Set(rows.map((r) => r.time))].sort();
  const lastFetch = feeds
    .map((f) => f.last_fetched_at)
    .filter((at): at is string => !!at)
    .sort()
    .at(-1);
  const checked = `${shell.at} today`;

  const health = (
    <ul>
      <li className="health-row">
        {lastFetch ? (
          <span className="health-ok">
            <Icon name="tick" />
          </span>
        ) : (
          <span className="health-warn">
            <Icon name="attention" />
          </span>
        )}
        <div className={lastFetch ? undefined : "stack-4"}>
          <p className={lastFetch ? undefined : "w6"}>
            {lastFetch ? "Your calendar has the plan" : feeds.length > 0 ? "No calendar has fetched the plan yet" : "No calendar is set up"}
          </p>
          <p className={lastFetch ? "prov" : "ty-sm"}>
            {lastFetch
              ? `Last fetched at ${atText(lastFetch)}`
              : feeds.length > 0
                ? "Open the calendar app once so it subscribes, then check back here."
                : `Add ${dog.name}'s plan to your calendar below, so its alarms remind you at each dose time.`}
          </p>
        </div>
        <span className="prov d-only">Checked {shell.at}</span>
      </li>
      <HomeScreenCheck checkedAt={shell.at} />
      {publicKey && <PhoneNotifications publicKey={publicKey} checkedAt={shell.at} lastSent={lastSentRow ? atText(lastSentRow.sent_at) : null} />}
      {emailReady && me && (
        <li className="health-row">
          {emailOn ? (
            <span className="health-ok">
              <Icon name="tick" />
            </span>
          ) : (
            <span className="health-warn">
              <Icon name="attention" />
            </span>
          )}
          <div className="stack-4">
            <p className={emailOn ? undefined : "w6"}>{emailOn ? "Email reminders are on" : "Email reminders are off"}</p>
            <p className={emailOn ? "prov" : "ty-sm"}>
              {emailOn
                ? `To ${me.email}, if a dose isn’t ticked 2 hours after its time and again at 21:00, and before each injection. If a dose someone else usually gives is still missed hours later, you’re told too.${lastEmailRow ? ` Last sent at ${atText(lastEmailRow.sent_at)}.` : ""}`
                : "Turn them on as a backup, in case a phone notification doesn’t arrive."}
            </p>
            <form action={setEmailReminders}>
              <input type="hidden" name="on" value={emailOn ? "off" : "on"} />
              <button className={emailOn ? "lnk ty-sm" : "btn btn-secondary"} type="submit" style={emailOn ? { minHeight: 0 } : { width: "auto" }}>
                {emailOn ? "Turn off email reminders" : "Turn on email reminders"}
              </button>
            </form>
          </div>
          <span className="prov d-only">Checked {shell.at}</span>
        </li>
      )}
      {soundTimes.length > 0 && (
        <li className="health-row">
          <Icon name="info" className="c2" />
          <div>
            <p>Silent mode and Focus can&rsquo;t be checked from here</p>
            <p className="prov">Make sure your phone can make a sound at {joinTimes(soundTimes)}.</p>
          </div>
          <span className="d-only" />
        </li>
      )}
    </ul>
  );

  const appCard = (app: "apple" | "google") => {
    const f = feed(app);
    return (
      <div className="cal-app">
        <div className="row between gap-12">
          <p className="cal-name">{APP_NAMES[app]}</p>
          {f?.last_fetched_at ? (
            <span className="chip chip-rec">
              <Icon name="tick" size={16} />
              Subscribed
            </span>
          ) : f ? (
            <span className="chip chip-dashed">Link made</span>
          ) : (
            <span className="chip chip-outline">Not set up</span>
          )}
        </div>
        {f && (
          <p className="prov">
            Added by {who(f.created_by)} on {formatDate(local(f.created_at).date)} ·{" "}
            {f.last_fetched_at ? `last fetched by ${FETCHER[app]} at ${atText(f.last_fetched_at)}` : "not fetched yet"}
          </p>
        )}
        {f && (
          <form action={stopCalendarLink}>
            <input type="hidden" name="dog_id" value={dog.id} />
            <input type="hidden" name="app" value={app} />
            <button className="lnk cal-remove" type="submit">
              Remove
            </button>
          </form>
        )}
        <AddCalendar dogId={dog.id} app={app} linked={!!f} />
      </div>
    );
  };
  const other = feed("other");
  const note = "Calendars refresh on their own schedule, sometimes only every few hours, so a change to the plan can take a while to show there.";

  return (
    <Page
      title="Reminders"
      band="overlap"
      sub={
        <>
          For {dog.name}&rsquo;s doses and injections<span className="d-only"> · checked {checked}</span>
        </>
      }
    >
      <div className="d-row" style={{ alignItems: "flex-start" }}>
        <section className="card lg stack-16" aria-labelledby="health" style={{ flex: "7 1 520px" }}>
          <div className="kicker m-only">
            <span>Reminder health</span>
            <span className="tn">Checked {checked}</span>
          </div>
          <h2 id="health" className="d-h d-only">
            Reminder health
          </h2>
          {health}
        </section>

        <section className="team-card" aria-labelledby="times" style={{ flex: "5 1 380px" }}>
          <div className="sec-h" style={{ alignItems: "center" }}>
            <h2 id="times" className="r-t">
              Reminder times
            </h2>
            <Link href="/dog" className="lnk" style={{ margin: "-12px 0" }}>
              Change
            </Link>
          </div>
          {rows.length === 0 ? (
            <p>Nothing on the care plan has a reminder time yet.</p>
          ) : (
            <ol className="recs times-list">
              {rows.map((r) => (
                <li key={r.key} className="rec">
                  <span className="rec-time">{r.time}</span>
                  <div>
                    <p className="rec-med">
                      <b className={`m-${r.jewel}`}>{r.name}</b>
                      {r.rest && ` ${r.rest}`}
                    </p>
                    <p className="prov" style={{ marginTop: 4 }}>
                      {r.sub}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="card lg stack-16 cal-card" aria-labelledby="calendar">
        <div className="stack-4">
          <h2 id="calendar" className="cal-title">
            Calendar
          </h2>
          <p className="hint cal-lead">Add {dog.name}&rsquo;s dose times and injection dates to your own calendar. It shows medicine names and times, never a dose.</p>
        </div>
        <div className="cal-apps">
          {appCard("apple")}
          {appCard("google")}
        </div>
        <div className="panel m-only" style={{ padding: "12px 16px" }}>
          <p className="ty-sm">{note}</p>
        </div>
        <div className="row between cal-foot">
          <p className="ty-sm c2 d-only" style={{ flex: "1 1 400px" }}>
            {note}
          </p>
          <div className="stack-4">
            <CopyCalendarLink dogId={dog.id} hasLive={!!other} />
            {other && (
              <form action={stopCalendarLink} className="row gap-12" style={{ flexWrap: "wrap", alignItems: "baseline" }}>
                <input type="hidden" name="dog_id" value={dog.id} />
                <input type="hidden" name="app" value="other" />
                <span className="prov">
                  Copied link made on {formatDate(local(other.created_at).date)} ·{" "}
                  {other.last_fetched_at ? `last fetched at ${atText(other.last_fetched_at)}` : "not fetched yet"}
                </span>
                <button className="lnk ty-sm" type="submit" style={{ minHeight: 0 }}>
                  Stop it
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <p className="prov" style={{ maxWidth: 720 }}>
        Tailhelm is a backup to your own routine. It is not a medical device and it does not replace your vet&rsquo;s instructions or your own
        checks. Reminders can fail: phones, calendars and email all fail sometimes. Always follow your vet&rsquo;s plan, keep your own routine,
        and call your vet if a dose is missed or you are worried.
      </p>
    </Page>
  );
}

function joinTimes(times: string[]) {
  return times.length === 1 ? times[0] : `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}`;
}
