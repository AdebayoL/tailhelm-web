"use client";

import { useState } from "react";
import { clearOfflinePages } from "@/lib/offline/client";
import { clearQueue, queuedTicks } from "@/lib/offline/queue";
import { signOut } from "@/app/sign-in/actions";

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
      className="stack-8"
    >
      {waiting > 0 && (
        <p role="alert" className="w6">
          {waiting === 1 ? "1 tick" : `${waiting} ticks`} made with no signal {waiting === 1 ? "has" : "have"} not
          been sent yet. Signing out deletes {waiting === 1 ? "it" : "them"}, and the household will not see{" "}
          {waiting === 1 ? "it" : "them"}.
        </p>
      )}
      <button type="submit" className="lnk" style={{ alignSelf: "flex-start" }}>
        {waiting > 0 ? "Sign out anyway" : "Sign out"}
      </button>
    </form>
  );
}
