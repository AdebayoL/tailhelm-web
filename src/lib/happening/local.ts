/**
 * The captures this phone has timed, kept in localStorage so they survive the
 * app being closed, a phone call, or no signal. The server is told when there
 * is a signal; until then this copy is the record. More than one can wait,
 * when a second crisis starts before the first reached Tailhelm. Browser-only,
 * except `parseLocal`, which is pure so it can be tested.
 */

import { type LiveThreshold, passedThresholds } from "./timer";

export type LocalCapture = {
  id: string;
  dogId: string;
  /** From the phone's clock, at the tap. */
  startedAt: string;
  endedAt: string | null;
  /** The keys of the pack's limits passed while it ran. */
  passed: string[];
  /** Whether Tailhelm has the start and the stop yet. */
  sentStart: boolean;
  sentStop: boolean;
};

export const KEY = "th-happening";
/** Kept this many at most, oldest dropped first; far more than a phone would ever hold unsent. */
const MAX = 20;
/** Fired on window whenever this phone's captures change. */
export const CAPTURE_CHANGED = "tailhelm-capture-changed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTime = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

function parseOne(v: Partial<LocalCapture> | null): LocalCapture | null {
  if (!v || typeof v !== "object" || typeof v.id !== "string" || !UUID.test(v.id) || typeof v.dogId !== "string" || !UUID.test(v.dogId)) return null;
  if (!isTime(v.startedAt) || (v.endedAt != null && !isTime(v.endedAt))) return null;
  return {
    id: v.id,
    dogId: v.dogId,
    startedAt: v.startedAt,
    endedAt: v.endedAt ?? null,
    passed: Array.isArray(v.passed) ? v.passed.filter((k): k is string => typeof k === "string") : [],
    sentStart: v.sentStart === true,
    sentStop: v.sentStop === true,
  };
}

/** The stored captures, oldest first, leaving out any that can't be trusted. */
export function parseLocal(raw: string | null): LocalCapture[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.map((v) => parseOne(v as Partial<LocalCapture>)).filter((c): c is LocalCapture => c !== null);
}

/** The capture running for the dog on this phone, if there is one. */
export function runningIn(list: LocalCapture[], dogId: string): LocalCapture | null {
  return [...list].reverse().find((c) => c.dogId === dogId && c.endedAt === null) ?? null;
}

export function readCaptures(): LocalCapture[] {
  try {
    return parseLocal(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

/** The captures with something Tailhelm doesn't have yet: a start, or a stop. */
export function unsentCaptures(): LocalCapture[] {
  return readCaptures().filter((c) => !c.sentStart || (c.endedAt !== null && !c.sentStop));
}

export function writeCaptures(list: LocalCapture[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Storage blocked: the timer still runs on screen, and the server copy is the record.
  }
  window.dispatchEvent(new Event(CAPTURE_CHANGED));
}

/** Changes one capture in place. */
export function updateCapture(id: string, change: Partial<LocalCapture>): void {
  writeCaptures(readCaptures().map((c) => (c.id === id ? { ...c, ...change } : c)));
}

export function forgetCapture(id: string): void {
  writeCaptures(readCaptures().filter((c) => c.id !== id));
}

/** Clears every capture kept on this phone, when someone signs out. */
export function clearCaptures(): void {
  writeCaptures([]);
}

/**
 * Starts timing now, on this phone, before anything reaches Tailhelm. If one
 * is already running for the dog here, that one carries on.
 */
export function startCapture(dogId: string): LocalCapture {
  const list = readCaptures();
  const running = runningIn(list, dogId);
  if (running) return running;
  const capture: LocalCapture = {
    id: crypto.randomUUID(),
    dogId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    passed: [],
    sentStart: false,
    sentStop: false,
  };
  writeCaptures([...list, capture]);
  return capture;
}

/**
 * "It has stopped", at the phone's time now, with the keys of the pack's
 * limits it passed. The capture may be one another phone started, which this
 * phone then holds until the stop is sent.
 */
export function stopCapture(
  capture: { id: string; dogId: string; startedAt: string },
  limits: LiveThreshold[],
): LocalCapture & { endedAt: string } {
  const list = readCaptures();
  const endedAt = new Date().toISOString();
  const passed = passedThresholds(limits, Date.parse(endedAt) - Date.parse(capture.startedAt)).map((t) => t.key);
  const mine = list.find((c) => c.id === capture.id);
  const stopped: LocalCapture & { endedAt: string } = mine
    ? { ...mine, endedAt: mine.endedAt ?? endedAt, passed: [...new Set([...mine.passed, ...passed])] }
    : { id: capture.id, dogId: capture.dogId, startedAt: capture.startedAt, endedAt, passed, sentStart: true, sentStop: false };
  writeCaptures(mine ? list.map((c) => (c.id === capture.id ? stopped : c)) : [...list, stopped]);
  return stopped;
}
