/**
 * Sends this phone's Happening now captures to Tailhelm, oldest first: each
 * start, then its stop, at the times the phone recorded. Browser-only.
 */
import { checkCapture, sendStart, sendStop } from "@/app/(app)/happening-now/actions";
import { type LocalCapture, forgetCapture, readCaptures, updateCapture } from "./local";

/** Whether a send changed anything here, so the page should show what Tailhelm now has. */
export type SendResult = { changed: boolean };

/**
 * The captures Tailhelm has in full since this page loaded, by the id they
 * had on this phone: the id they have there and, when another phone's
 * "It has stopped" landed first, the time it kept.
 */
const finished = new Map<string, { id: string; stoppedAt: string | null }>();

export function finishedAs(localId: string): { id: string; stoppedAt: string | null } | null {
  return finished.get(localId) ?? null;
}

let running: Promise<SendResult> | null = null;
let queued: Promise<SendResult> | null = null;

/**
 * Sends whatever Tailhelm doesn't have yet. If someone else's timer was
 * already running for the dog, this phone joins theirs. Stops at the first
 * capture that can't get through, so they arrive in order. Asked again while
 * sending, it goes round once more afterwards for whatever changed meanwhile.
 */
export function sendCapture(): Promise<SendResult> {
  if (!running) {
    running = send().finally(() => {
      running = null;
    });
    return running;
  }
  queued ??= running.then(() => {
    queued = null;
    return sendCapture();
  });
  return queued;
}

async function send(): Promise<SendResult> {
  const result: SendResult = { changed: false };
  if (!navigator.onLine) return result;
  for (const kept of readCaptures()) {
    let capture: LocalCapture = kept;
    try {
      if (!capture.sentStart) {
        const started = await sendStart({ id: capture.id, dogId: capture.dogId, startedAt: capture.startedAt });
        if ("failed" in started) return result;
        const change = "joined" in started ? { id: started.joined.id, startedAt: started.joined.startedAt, sentStart: true } : { sentStart: true };
        updateCapture(capture.id, change);
        capture = { ...capture, ...change };
        result.changed = true;
      }
      if (capture.endedAt && !capture.sentStop) {
        const stopped = await sendStop({ id: capture.id, endedAt: capture.endedAt, passed: capture.passed });
        if ("failed" in stopped) return result;
        // Saved, stopped first by someone else, or removed: either way Tailhelm has the last word.
        finished.set(kept.id, { id: capture.id, stoppedAt: "alreadyStopped" in stopped ? stopped.alreadyStopped.endedAt : null });
        forgetCapture(capture.id);
        result.changed = true;
      }
    } catch {
      // Still no way through; try again on the next signal.
      return result;
    }
  }
  return result;
}

/**
 * Forgets timers this phone shows running that Tailhelm has since seen
 * stopped on another phone, or removed, so this phone stops showing them.
 */
export async function settleCaptures(): Promise<void> {
  if (!navigator.onLine) return;
  for (const c of readCaptures()) {
    if (!c.sentStart || c.endedAt) continue;
    const r = await checkCapture(c.id).catch(() => null);
    if (r && ("stoppedAt" in r || "gone" in r)) forgetCapture(c.id);
  }
}
