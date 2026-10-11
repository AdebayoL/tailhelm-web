"use client";

import { useState } from "react";
import { clearOfflinePages } from "@/lib/offline/client";
import { clearQueue, queuedTicks } from "@/lib/offline/queue";
import { signOut } from "../../sign-in/actions";

const link = "min-h-12 text-lg text-green underline underline-offset-4";

/**
 * Signs out after deleting everything kept on this phone for offline use. If
 * ticks made with no signal are still waiting, says so first, because signing
 * out deletes them and the household would never see them.
 */
export function SignOutButton() {
  const [waiting, setWaiting] = useState(0);

  async function leave() {
    await clearQueue();
    await clearOfflinePages();
    await signOut();
  }

  return (
    <form
      action={async () => {
        const count = waiting > 0 ? 0 : (await queuedTicks().catch(() => [])).length;
        if (count > 0) {
          setWaiting(count);
          return;
        }
        await leave();
      }}
      className="flex flex-col gap-2"
    >
      {waiting > 0 && (
        <p role="alert" className="text-lg font-semibold">
          {waiting === 1 ? "1 tick" : `${waiting} ticks`} made with no signal {waiting === 1 ? "has" : "have"} not
          been sent yet. Signing out deletes {waiting === 1 ? "it" : "them"}, and the household will not see{" "}
          {waiting === 1 ? "it" : "them"}.
        </p>
      )}
      <button type="submit" className={`${link} self-start`}>
        {waiting > 0 ? "Sign out anyway" : "Sign out"}
      </button>
    </form>
  );
}
