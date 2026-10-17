"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { Mark } from "@/app/_components/mark";
import { type PhoneState, isPhone, needsHomeScreen, phoneState, subscribePhone, subscriptionParts } from "@/lib/push/client";
import { type SetupStep, nextStep, previousStep, stepHref, stepLabel } from "@/lib/setup/steps";
import { type TestState, savePhone, sendTestNotification } from "../(main)/reminders/actions";

const subscribe = () => () => {};

/** Whether this device needs the Home Screen step; null on the server and before the page is live. */
function useNeedsHomeScreen(): boolean | null {
  return useSyncExternalStore(subscribe, needsHomeScreen, () => null);
}

/** "phone" or "computer", for the words. */
function useDevice(): "phone" | "computer" {
  return useSyncExternalStore(subscribe, () => (isPhone() ? "phone" : "computer"), () => "phone");
}

/** "Step 2 of 4", and the way back, once the device is known. */
export function StepHead({ step }: { step: SetupStep }) {
  const home = useNeedsHomeScreen();
  if (home === null) return <p className="kicker" aria-hidden="true">&nbsp;</p>;
  const back = previousStep(step, home);
  return (
    <div className="stack-8">
      {back && (
        <Link className="back" href={stepHref(back)}>
          <Icon name="back" />
          Back
        </Link>
      )}
      <p className="kicker">{stepLabel(step, home)}</p>
    </div>
  );
}

/**
 * Passing a step without doing it. The cost is said plainly first, and only
 * then can the person carry on.
 */
export function Refuse({ label, warning, next, nextLabel }: { label: string; warning: string; next: SetupStep; nextLabel: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="lnk" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="stack-12">
      <div className="banner banner-warn" role="status">
        <Icon name="attention" />
        <span>{warning}</span>
      </div>
      <Link className="btn btn-secondary" href={stepHref(next)}>
        {nextLabel}
      </Link>
    </div>
  );
}

function Continue({ step, label = "Continue" }: { step: SetupStep; label?: string }) {
  const next = nextStep(step);
  if (!next) return null;
  return (
    <Link className="btn btn-primary" href={stepHref(next)}>
      {label}
    </Link>
  );
}

/** On an iPhone or iPad in the browser: how to add Tailhelm to the Home Screen. Anywhere else this step is passed straight away. */
export function HomeStep() {
  const home = useNeedsHomeScreen();
  const router = useRouter();
  useEffect(() => {
    if (home === false) router.replace(stepHref("notifications"));
  }, [home, router]);
  if (!home) return null;
  return (
    <>
      <div className="stack-8">
        <h1 className="auth-title">Add Tailhelm to your Home Screen</h1>
        <p className="ty-lead c2">On an iPhone or iPad, Tailhelm can only send notifications once it is on your Home Screen.</p>
      </div>
      <ol className="setup-how">
        <li>
          <span className="setup-glyph" aria-hidden="true">
            <Icon name="share" size={28} />
          </span>
          <span>
            Tap the <b>Share</b> button. In Safari it is at the bottom of the screen. If you can&rsquo;t see it, tap <b>⋯</b> first.
          </span>
        </li>
        <li>
          <span className="setup-glyph" aria-hidden="true">
            <Icon name="addSquare" size={28} />
          </span>
          <span>
            Scroll down and tap <b>Add to Home Screen</b>.
          </span>
        </li>
        <li>
          <span className="setup-glyph setup-add" aria-hidden="true">
            Add
          </span>
          <span>
            Tap <b>Add</b> at the top right.
          </span>
        </li>
        <li>
          <span className="setup-glyph setup-app" aria-hidden="true">
            <Mark size={28} />
          </span>
          <span>
            Open <b>Tailhelm</b> from your Home Screen and carry on there. If it asks you to sign in, use the same email address.
          </span>
        </li>
      </ol>
      <Refuse
        label="I can’t add it now"
        warning="Without it, Tailhelm can’t send notifications to this device. Your reminders will rely on your calendar’s alarms and on email, so the calendar step matters most."
        next="notifications"
        nextLabel="Continue without it"
      />
    </>
  );
}

/** Turns on notifications for this device, with the one tap the browser requires. */
export function NotificationsStep({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<PhoneState | null>(publicKey ? null : "unsupported");
  const [problem, setProblem] = useState(false);
  const [pending, start] = useTransition();
  const device = useDevice();

  useEffect(() => {
    if (!publicKey) return;
    let live = true;
    phoneState()
      .then(async ({ state, subscription }) => {
        // A device already subscribed is saved again, so it belongs to whoever is signed in now.
        if (subscription) await savePhone(subscriptionParts(subscription), navigator.userAgent);
        if (live) setState(state);
      })
      .catch(() => live && setState("unsupported"));
    return () => {
      live = false;
    };
  }, [publicKey]);

  const turnOn = () =>
    start(async () => {
      setProblem(false);
      try {
        const subscription = await subscribePhone(publicKey!);
        if (!subscription) {
          setState((await phoneState()).state);
          return;
        }
        const saved = await savePhone(subscriptionParts(subscription), navigator.userAgent);
        if (!saved.ok) setProblem(true);
        else setState("on");
      } catch (error) {
        console.error("[push] could not turn on", error);
        setProblem(true);
      }
    });

  const without = "Without notifications, reminders rely on your calendar’s alarms and on email, which can be slow. You can turn them on any time in Reminders.";

  return (
    <>
      <div className="stack-8">
        <h1 className="auth-title">Turn on notifications</h1>
        <p className="ty-lead c2">So this {device} reminds you at each dose time, and tells you when someone else ticks a dose.</p>
      </div>
      {state === null ? (
        <p className="prov" aria-busy="true">
          Checking this {device}…
        </p>
      ) : state === "on" ? (
        <>
          <p className="setup-done">
            <Icon name="tick" />
            Notifications are on for this {device}.
          </p>
          <Continue step="notifications" />
        </>
      ) : state === "off" ? (
        <>
          <button type="button" className={pending ? "btn btn-primary is-loading" : "btn btn-primary"} disabled={pending} onClick={turnOn}>
            {pending && <span className="spin" aria-hidden="true" />}
            Turn on notifications
          </button>
          <p className="hint">Your {device} will ask whether to allow notifications from Tailhelm. Choose Allow.</p>
          {problem && (
            <p role="alert" className="err">
              <Icon name="attention" />
              Notifications could not be turned on. Try again, and check Tailhelm is allowed to send them.
            </p>
          )}
          <Refuse label="Not now" warning={without} next="calendar" nextLabel="Continue without notifications" />
        </>
      ) : state === "blocked" ? (
        <>
          <div className="panel stack-8">
            <p className="w6">Notifications are blocked for Tailhelm</p>
            <p>Allow them for Tailhelm in your {device}&rsquo;s settings, under Notifications, then come back to this page.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            I&rsquo;ve allowed them
          </button>
          <Refuse label="Leave them blocked" warning={without} next="calendar" nextLabel="Continue without notifications" />
        </>
      ) : state === "needs-home-screen" ? (
        <>
          <div className="panel stack-8">
            <p className="w6">Notifications can&rsquo;t reach this device yet</p>
            <p>On an iPhone or iPad, notifications only work once Tailhelm is on your Home Screen.</p>
          </div>
          <Link className="btn btn-secondary" href={stepHref("home")}>
            Show me how to add it
          </Link>
          <Refuse label="Carry on without them" warning={without} next="calendar" nextLabel="Continue without notifications" />
        </>
      ) : (
        <>
          <div className="panel stack-8">
            <p className="w6">This browser can&rsquo;t show notifications</p>
            <p>Open Tailhelm on your phone to turn them on there. Your calendar&rsquo;s alarms and email still remind you.</p>
          </div>
          <Continue step="notifications" />
        </>
      )}
    </>
  );
}

const SENT: Record<NonNullable<TestState["outcome"]>, string> = {
  sent: "Test sent. It should show within a minute.",
  already_sent: "Test sent. It should show within a minute.",
  no_device: "No device is set up to receive it. Go back a step and turn notifications on again.",
  failed: "The test could not be sent. Try again in a few minutes.",
  not_set_up: "Notifications are not available yet.",
};

/** Sends a test notification and asks whether it arrived. */
export function TestStep() {
  const [on, setOn] = useState<boolean | null>(null);
  const [test, setTest] = useState<TestState | null>(null);
  const [missed, setMissed] = useState(false);
  const [pending, start] = useTransition();
  const device = useDevice();

  useEffect(() => {
    let live = true;
    phoneState()
      .then(({ state }) => live && setOn(state === "on"))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, []);

  const send = () =>
    start(async () => {
      setMissed(false);
      setTest(await sendTestNotification("setup"));
    });

  if (on === null) {
    return (
      <p className="prov" aria-busy="true">
        Checking this {device}…
      </p>
    );
  }

  if (!on) {
    return (
      <>
        <div className="stack-8">
          <h1 className="auth-title">Send a test</h1>
          <p className="ty-lead c2">
            Notifications are off on this {device}, so there is no notification to test. Your calendar&rsquo;s alarms and reminder emails are
            your reminders. You can turn notifications on any time in Reminders.
          </p>
        </div>
        <Continue step="test" />
      </>
    );
  }

  const sent = test?.outcome === "sent" || test?.outcome === "already_sent";
  return (
    <>
      <div className="stack-8">
        <h1 className="auth-title">Send a test</h1>
        <p className="ty-lead c2">Check that a reminder reaches this {device}.</p>
      </div>
      {!sent ? (
        <>
          <button type="button" className={pending ? "btn btn-primary is-loading" : "btn btn-primary"} disabled={pending} onClick={send}>
            {pending && <span className="spin" aria-hidden="true" />}
            Send a test notification
          </button>
          {test?.outcome && (
            <p role="alert" className="err">
              <Icon name="attention" />
              {SENT[test.outcome]}
            </p>
          )}
        </>
      ) : (
        <>
          <p role="status">{SENT[test.outcome!]}</p>
          <p className="w6">Did it show on this {device}?</p>
          <Continue step="test" label="Yes, it arrived" />
          {!missed ? (
            <button type="button" className="btn btn-secondary" onClick={() => setMissed(true)}>
              No, it didn&rsquo;t
            </button>
          ) : (
            <>
              <div className="panel stack-8">
                <p>
                  Check that Focus or Do Not Disturb is off, and that notifications for Tailhelm are allowed in your {device}&rsquo;s
                  settings. Then send another.
                </p>
              </div>
              <button type="button" className={pending ? "btn btn-secondary is-loading" : "btn btn-secondary"} disabled={pending} onClick={send}>
                {pending && <span className="spin" aria-hidden="true" />}
                Send another test
              </button>
              <Refuse
                label="Carry on without a test"
                warning="Until a test arrives, rely on your calendar’s alarms. You can send another test any time in Reminders."
                next="acknowledge"
                nextLabel="Continue"
              />
            </>
          )}
        </>
      )}
    </>
  );
}

/** Continue once a calendar link exists; otherwise the plain cost of going on without one. */
export function CalendarNext({ linked }: { linked: boolean }) {
  if (linked) return <Continue step="calendar" />;
  return (
    <Refuse
      label="I don’t use a calendar"
      warning="Without a calendar, reminders rely on notifications and email, and both can fail. Your calendar’s alarms are the reminder that works when they don’t. You can add it any time in Reminders."
      next="test"
      nextLabel="Continue without a calendar"
    />
  );
}
