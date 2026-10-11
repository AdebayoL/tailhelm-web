/**
 * The page side of the service worker in public/sw.js. Browser-only.
 */

/** Cache names start with this; the service worker owns the rest of the name. */
const CACHE_PREFIX = "tailhelm-pages";

/** Registers the service worker and asks it to keep the pages needed with no signal. */
export async function startOfflineSupport() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const ready = await navigator.serviceWorker.ready;
    ready.active?.postMessage({ type: "warm" });
  } catch (error) {
    console.error("[offline] service worker registration failed", error);
  }
}

/** Deletes every page kept for offline use, so the next person on this phone sees none of it. */
export async function clearOfflinePages() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch (error) {
    console.error("[offline] could not clear kept pages", error);
  }
}

/** When the copy of this page kept for offline use was saved, or null if none is kept. */
export async function keptPageSavedAt(url: string): Promise<Date | null> {
  if (!("caches" in window)) return null;
  try {
    const names = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIX));
    for (const name of names) {
      const kept = await (await caches.open(name)).match(url);
      const saved = kept ? Date.parse(kept.headers.get("Date") ?? "") : NaN;
      if (Number.isFinite(saved)) return new Date(saved);
    }
  } catch {
    // Storage unavailable; the banner falls back to plain words.
  }
  return null;
}
