/**
 * The phone's queue of ticks made with no signal, in IndexedDB so it survives
 * the app being closed. Browser-only. Cleared on sign-out with the kept pages.
 */
import type { QueuedTick } from "./ticks";

const DB = "tailhelm-offline";
const TICKS = "ticks";
const OUTCOMES = "outcomes";
/** Fired on window whenever the queue or its outcomes change. */
export const QUEUE_CHANGED = "tailhelm-queue-changed";

export type Outcome = { id: number; text: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(TICKS, { keyPath: "key" });
      req.result.createObjectStore(OUTCOMES, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = op(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const changed = () => window.dispatchEvent(new Event(QUEUE_CHANGED));

export async function queueTick(tick: QueuedTick): Promise<void> {
  // add, not put: a second Given for the same dose keeps the first time.
  await run(TICKS, "readwrite", (s) => s.add(tick)).catch((e: unknown) => {
    if (!(e instanceof DOMException && e.name === "ConstraintError")) throw e;
  });
  changed();
}

export async function queuedTicks(): Promise<QueuedTick[]> {
  if (!("indexedDB" in window)) return [];
  return run<QueuedTick[]>(TICKS, "readonly", (s) => s.getAll() as IDBRequest<QueuedTick[]>);
}

export async function removeQueuedTick(key: string): Promise<void> {
  await run(TICKS, "readwrite", (s) => s.delete(key));
  changed();
}

export async function addOutcome(text: string): Promise<void> {
  await run(OUTCOMES, "readwrite", (s) => s.add({ text }));
  changed();
}

export async function outcomes(): Promise<Outcome[]> {
  if (!("indexedDB" in window)) return [];
  return run<Outcome[]>(OUTCOMES, "readonly", (s) => s.getAll() as IDBRequest<Outcome[]>);
}

export async function dismissOutcome(id: number): Promise<void> {
  await run(OUTCOMES, "readwrite", (s) => s.delete(id));
  changed();
}

/** Deletes everything waiting on this phone, for sign-out. */
export async function clearQueue(): Promise<void> {
  if (!("indexedDB" in window)) return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  changed();
}
