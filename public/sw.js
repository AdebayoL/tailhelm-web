/* Tailhelm service worker: keeps the app usable with no signal.
 *
 * - Built files (scripts, styles, fonts, icons) never change at a given URL,
 *   so they come from the cache first.
 * - App pages come from the network first. Each one that loads is kept, so a
 *   page opened with no signal shows what it said when it was last opened.
 * - Nothing else is touched: sign-in, the calendar feed, downloads and all
 *   data requests go straight to the network and are never kept.
 *
 * Kept pages hold the dog's records, so they are deleted when the owner signs
 * out, and whenever a page load shows the session has ended.
 */

const PAGES = "tailhelm-pages-v1";
const STATIC = "tailhelm-static-v1";
/** Built files kept at most; the oldest go first. */
const STATIC_LIMIT = 300;

/** The signed-in pages that may be kept for offline use. Matches PROTECTED_PREFIXES. */
const APP_PAGES = ["/today", "/trends", "/care-team", "/dog", "/emergency", "/vet-visit", "/reminders"];
/** Never kept: downloads, not pages. */
const NEVER_KEEP = ["/dog/export"];
/** Fetched ahead so they open with no signal even before the owner visits them. */
const WARM_PAGES = ["/today", "/emergency", "/vet-visit"];

const under = (path, prefix) => path === prefix || path.startsWith(prefix + "/");

/** What to do with a request: "static", "page" or null to leave it alone. */
function classify(request, origin) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== origin) return null;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return "static";
  if (request.mode !== "navigate") return null;
  if (NEVER_KEEP.some((p) => under(url.pathname, p))) return null;
  return APP_PAGES.some((p) => under(url.pathname, p)) ? "page" : null;
}

/** A page response worth keeping: a real page for a signed-in owner, not a redirect to sign-in. */
function keepable(response) {
  return response.ok && !response.redirected && response.type === "basic";
}

const OFFLINE_HTML = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>No signal · Tailhelm</title>
<style>
body{font-family:system-ui,sans-serif;background:#f7f3ec;color:#1b1b1a;margin:0;padding:24px;font-size:18px;line-height:1.5}
@media (prefers-color-scheme:dark){body{background:#161513;color:#ece7df}a{color:#8fc9a8}}
a{color:#1f4d3a;display:inline-block;min-height:48px;padding:12px 0}
</style></head>
<body><h1>No signal</h1>
<p>This page has not been opened on this phone with a signal yet, so there is nothing saved to show.</p>
<p><a href="/today">Today</a><br><a href="/emergency">Emergency</a></p>
</body></html>`;

async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((k) => cache.delete(k)));
}

async function fromStatic(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimStatic();
  }
  return response;
}

async function clearPages() {
  await caches.delete(PAGES);
}

async function fromPage(request) {
  try {
    const response = await fetch(request);
    if (keepable(response)) {
      const cache = await caches.open(PAGES);
      await cache.put(request.url, response.clone());
    } else if (response.type === "opaqueredirect" || response.redirected) {
      // App pages only redirect to sign-in: the session has ended, so nothing kept may be shown.
      await clearPages();
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES);
    const kept = (await cache.match(request.url)) ?? (await cache.match(new URL("/today", request.url).href));
    return kept ?? new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

/** A kept page older than this is fetched again when the app is next opened. */
const WARM_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function fresh(response) {
  const saved = Date.parse(response.headers.get("Date") ?? "");
  return Number.isFinite(saved) && Date.now() - saved < WARM_MAX_AGE_MS;
}

/** Fetches the pages an owner may need with no signal, unless a recent copy is already kept. */
async function warm() {
  const cache = await caches.open(PAGES);
  await Promise.all(
    WARM_PAGES.map(async (path) => {
      const url = new URL(path, self.location.origin).href;
      const kept = await cache.match(url);
      if (kept && fresh(kept)) return;
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (keepable(response)) await cache.put(url, response);
      } catch {
        // No signal now; it will be fetched on a later visit.
      }
    }),
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC];
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("tailhelm-") && !keep.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const kind = classify(event.request, self.location.origin);
  if (kind === "static") event.respondWith(fromStatic(event.request));
  else if (kind === "page") event.respondWith(fromPage(event.request));
});

self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  const type = event.data && event.data.type;
  if (type === "warm") event.waitUntil(warm());
  else if (type === "clear") event.waitUntil(clearPages());
});
