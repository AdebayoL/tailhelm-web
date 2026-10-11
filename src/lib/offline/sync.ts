/**
 * Sends the ticks waiting on the phone. Browser-only.
 */
import { formatDate } from "@/lib/plan/input";
import { sendQueuedTick } from "@/app/(app)/today/actions";
import { addOutcome, queuedTicks, removeQueuedTick } from "./queue";
import { queuedTickOutcomeText } from "./ticks";

let running: Promise<number> | null = null;

/** Sends every waiting tick, oldest first. Returns how many reached Tailhelm. */
export function sendWaitingTicks(): Promise<number> {
  running ??= send().finally(() => {
    running = null;
  });
  return running;
}

async function send(): Promise<number> {
  const waiting = (await queuedTicks()).sort((a, b) => a.givenAt.localeCompare(b.givenAt));
  let sent = 0;
  for (const tick of waiting) {
    if (!navigator.onLine) break;
    let result;
    try {
      result = await sendQueuedTick({ planItemId: tick.planItemId, slot: tick.slot, givenAt: tick.givenAt });
    } catch {
      // Still no way through; try again on the next signal.
      break;
    }
    const text = queuedTickOutcomeText(tick, result, formatDate);
    if (text) await addOutcome(text);
    await removeQueuedTick(tick.key);
    sent += 1;
  }
  return sent;
}
