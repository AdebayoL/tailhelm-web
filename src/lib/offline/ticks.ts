/**
 * Ticks made with no signal. They wait on the phone and are sent, at the time
 * they were made, once there is a signal. Pure, so it can be tested.
 */

/** A tick sent this late is no longer trusted to belong to the dose it names. */
export const QUEUED_TICK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Phone clocks drift; a tick a little in the future is taken as now. */
const CLOCK_SLACK_MS = 5 * 60 * 1000;

export type QueuedTick = {
  /** One per dose per day, the same lock the database keeps. */
  key: string;
  planItemId: string;
  slot: string;
  /** The owner's local date of the dose. */
  givenOn: string;
  /** When Given was pressed, as an ISO time from the phone's clock. */
  givenAt: string;
  /** For the words if it cannot be recorded. */
  product: string | null;
};

export function queuedTickKey(planItemId: string, givenOn: string, slot: string): string {
  return `${planItemId}|${givenOn}|${slot}`;
}

/** The time a queued tick was made, or null if it cannot be trusted. */
export function queuedTickTime(raw: unknown, now: Date): Date | null {
  if (typeof raw !== "string") return null;
  const at = new Date(raw);
  const ms = at.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms > now.getTime() + CLOCK_SLACK_MS) return null;
  if (ms < now.getTime() - QUEUED_TICK_MAX_AGE_MS) return null;
  return ms > now.getTime() ? now : at;
}

/** What the owner is told when a queued tick has been sent. Null when it simply went through. */
export function queuedTickOutcomeText(
  tick: Pick<QueuedTick, "slot" | "givenOn" | "product">,
  result: { alreadyGiven?: { by: string; at: string }; failed?: boolean },
  formatDate: (d: string) => string,
): string | null {
  const what = `${tick.product ?? "The dose"} at ${tick.slot} on ${formatDate(tick.givenOn)}`;
  if (result.alreadyGiven) {
    const who = result.alreadyGiven.by === "you" ? "You" : result.alreadyGiven.by;
    return `${what}: ${who} had already ticked it at ${result.alreadyGiven.at}. Your tick from no signal has not been recorded twice.`;
  }
  if (result.failed) return `${what}: your tick from no signal could not be recorded. Check Today and tick it again if it was given.`;
  return null;
}
