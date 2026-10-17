"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/app/_components/icon";
import { type PhoneState, phoneState, subscribePhone, subscriptionParts } from "@/lib/push/client";
import { type TestState, savePhone, sendTestNotification } from "./actions";

const TEST_WORDS: Record<NonNullable<TestState["outcome"]>, string> = {
  sent: "Test sent. It should show on this phone within a minute.",
  already_sent: "Test sent.",
  no_device: "No phone is set up to receive it. Turn notifications on again.",
  failed: "The test could not be sent. Try again in a few minutes.",
  not_set_up: "Notifications are not available yet.",
};

/**
 * Reminder health's notifications row: whether this phone gets notifications,
 * with the one step that turns them on and a test to prove they arrive.
 */
export function PhoneNotifications({ publicKey, checkedAt, lastSent }: { publicKey: string; checkedAt: string; lastSent: string | null }) {
  const [state, setState] = useState<PhoneState | null>(null);
  const [problem, setProblem] = useState(false);
  const [test, setTest] = useState<TestState | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    phoneState()
      .then(async ({ state, subscription }) => {
        // A phone already subscribed is saved again, so it belongs to whoever is signed in now.
        if (subscription) await savePhone(subscriptionParts(subscription), navigator.userAgent);
        if (live) setState(state);
      })
      .catch(() => live && setState("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  if (state === null) return null;

  const turnOn = () =>
    start(async () => {
      setProblem(false);
      try {
        const subscription = await subscribePhone(publicKey);
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

  const sendTest = () =>
    start(async () => {
      setTest(await sendTestNotification());
    });

  const on = state === "on";
  const words: Record<PhoneState, { title: string; detail: string }> = {
    on: {
      title: "Notifications are on for this phone",
      detail: lastSent ? `Last sent to your phones at ${lastSent}.` : "Each dose time, and 2 hours later if it isn’t ticked. If a dose someone else usually gives is still missed hours later, you’re told too.",
    },
    off: {
      title: "Notifications are off on this phone",
      detail: "Turn them on so this phone reminds you at each dose time, and tells you when someone else ticks a dose.",
    },
    blocked: {
      title: "Notifications are blocked for Tailhelm",
      detail: "Allow them for Tailhelm in your phone’s Settings, under Notifications, then come back here.",
    },
    "needs-home-screen": {
      title: "Add Tailhelm to your Home Screen for notifications",
      detail: "On iPhone and iPad, notifications only work from the Home Screen app. Open it from there, then turn them on here.",
    },
    unsupported: {
      title: "This browser can’t show notifications",
      detail: "Use the calendar below, or open Tailhelm on your phone to turn notifications on there.",
    },
  };

  return (
    <li className="health-row">
      {on ? (
        <span className="health-ok">
          <Icon name="tick" />
        </span>
      ) : state === "off" || state === "blocked" ? (
        <span className="health-warn">
          <Icon name="attention" />
        </span>
      ) : (
        <Icon name="info" className="c2" />
      )}
      <div className="stack-8">
        <div className={on ? undefined : "stack-4"}>
          <p className={on ? undefined : "w6"}>{words[state].title}</p>
          <p className={on ? "prov" : "ty-sm"}>{words[state].detail}</p>
        </div>
        {state === "off" && (
          <button
            type="button"
            className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}
            style={{ alignSelf: "flex-start", width: "auto" }}
            disabled={pending}
            onClick={turnOn}
          >
            Turn on notifications
          </button>
        )}
        {on && (
          <button type="button" className="lnk" style={{ alignSelf: "flex-start" }} disabled={pending} onClick={sendTest}>
            Send a test
          </button>
        )}
        {problem && (
          <p role="alert" className="ty-sm">
            Notifications could not be turned on. Try again, and check Tailhelm is allowed to send them.
          </p>
        )}
        {test?.outcome && (
          <p role="status" className="ty-sm">
            {TEST_WORDS[test.outcome]}
          </p>
        )}
      </div>
      <span className="prov d-only">Checked {checkedAt}</span>
    </li>
  );
}
