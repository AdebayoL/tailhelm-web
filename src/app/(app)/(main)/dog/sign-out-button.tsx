"use client";

import { useState } from "react";
import { Icon } from "@/app/_components/icon";
import { Sheet } from "@/app/_components/sheet";
import { clearOfflinePages } from "@/lib/offline/client";
import { clearQueue, queuedTicks } from "@/lib/offline/queue";
import { clearCaptures, unsentCaptures } from "@/lib/happening/local";
import { signOut } from "@/app/sign-in/actions";
import { unsubscribePhone } from "@/lib/push/client";
import { forgetPhone } from "../reminders/actions";

/**
 * Signs out after deleting everything kept on this phone for offline use and
 * stopping its notifications, so the next person on it gets none of them. If
 * ticks or Happening now timers made with no signal are still waiting, asks
 * first, because signing out deletes them and the household would never see
 * them.
 */
export function SignOutButton() {
  const [waiting, setWaiting] = useState<{ ticks: number; timers: number } | null>(null);

  async function leave() {
    await clearQueue();
    clearCaptures();
    await clearOfflinePages();
    const endpoint = await unsubscribePhone();
    if (endpoint) await forgetPhone(endpoint).catch(() => {});
    await signOut();
  }

  const count = waiting ? waiting.ticks + waiting.timers : 0;
  return (
    <>
      <form
        action={async () => {
          const ticks = (await queuedTicks().catch(() => [])).length;
          const timers = unsentCaptures().length;
          if (ticks + timers > 0) {
            setWaiting({ ticks, timers });
            return;
          }
          await leave();
        }}
        className="stack-8"
      >
        <button type="submit" className="lnk" style={{ alignSelf: "flex-start" }}>
          Sign out
        </button>
      </form>
      {waiting && (
        <Sheet label="Sign out?" onClose={() => setWaiting(null)} alert>
          <h2 className="ty-page">Sign out?</h2>
          <p className="banner banner-info">
            <Icon name="noSignal" />
            <span className="tn">
              <b>
                {unsent(waiting.ticks, waiting.timers)} made with no signal {count === 1 ? "has" : "have"} not been sent yet.
              </b>
            </span>
          </p>
          <p className="ty-body c2" style={{ textWrap: "pretty" }}>
            {count === 1 ? "It is" : "They are"} kept on this phone and {count === 1 ? "is" : "are"} sent when there is a signal, as
            long as you stay signed in.
          </p>
          <div className="stack-12">
            <button type="button" className="btn btn-primary" onClick={() => setWaiting(null)}>
              Stay signed in
            </button>
            <form action={leave}>
              <button type="submit" className="btn btn-secondary">
                Sign out anyway
              </button>
            </form>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** "2 ticks", "1 Happening now timer", "1 tick and 1 Happening now timer". */
function unsent(ticks: number, timers: number): string {
  const parts = [
    ticks > 0 && (ticks === 1 ? "1 tick" : `${ticks} ticks`),
    timers > 0 && (timers === 1 ? "1 Happening now timer" : `${timers} Happening now timers`),
  ].filter(Boolean);
  return parts.join(" and ");
}
