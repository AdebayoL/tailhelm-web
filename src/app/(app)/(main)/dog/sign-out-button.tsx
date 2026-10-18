"use client";

import { useState } from "react";
import { clearOfflinePages } from "@/lib/offline/client";
import { clearQueue, queuedTicks } from "@/lib/offline/queue";
import { clearCaptures, unsentCaptures } from "@/lib/happening/local";
import { signOut } from "@/app/sign-in/actions";
import { unsubscribePhone } from "@/lib/push/client";
import { forgetPhone } from "../reminders/actions";

/**
 * Signs out after deleting everything kept on this phone for offline use and
 * stopping its notifications, so the next person on it gets none of them. If
 * ticks made with no signal are still waiting, says so first, because signing
 * out deletes them and the household would never see them.
 */
export function SignOutButton() {
  const [waiting, setWaiting] = useState(0);
  const [timers, setTimers] = useState(0);

  async function leave() {
    await clearQueue();
    clearCaptures();
    await clearOfflinePages();
    const endpoint = await unsubscribePhone();
    if (endpoint) await forgetPhone(endpoint).catch(() => {});
    await signOut();
  }

  return (
    <form
      action={async () => {
        const warned = waiting + timers > 0;
        const count = warned ? 0 : (await queuedTicks().catch(() => [])).length;
        const timed = warned ? 0 : unsentCaptures().length;
        if (count + timed > 0) {
          setWaiting(count);
          setTimers(timed);
          return;
        }
        await leave();
      }}
      className="stack-8"
    >
      {waiting + timers > 0 && (
        <p role="alert" className="w6">
          {unsent(waiting, timers)} made with no signal {waiting + timers === 1 ? "has" : "have"} not been sent yet.
          Signing out deletes {waiting + timers === 1 ? "it" : "them"}, and the household will not see{" "}
          {waiting + timers === 1 ? "it" : "them"}.
        </p>
      )}
      <button type="submit" className="lnk" style={{ alignSelf: "flex-start" }}>
        {waiting + timers > 0 ? "Sign out anyway" : "Sign out"}
      </button>
    </form>
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
