import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import { PROTECTED_PREFIXES } from "@/lib/auth/input";

/**
 * Runs public/sw.js in a sandbox with a stand-in Cache API and fetch, so its
 * rules about what is kept can be tested without a browser.
 */

const ORIGIN = "https://www.tailhelm.com";
const source = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");

class FakeCache {
  entries = new Map<string, Response>();
  async match(key: string | Request) {
    const r = this.entries.get(typeof key === "string" ? key : key.url);
    return r?.clone();
  }
  async put(key: string | Request, r: Response) {
    this.entries.set(typeof key === "string" ? key : key.url, r);
  }
  async keys() {
    return [...this.entries.keys()].map((k) => new Request(k));
  }
  async delete(key: string | Request) {
    return this.entries.delete(typeof key === "string" ? key : key.url);
  }
}

class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async keys() {
    return [...this.stores.keys()];
  }
}

type Handler = (event: unknown) => void;

function load(fetchImpl: (input: Request | string) => Promise<Response>) {
  const handlers: Record<string, Handler> = {};
  const caches = new FakeCaches();
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, h: Handler) => (handlers[type] = h),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  const context = vm.createContext({ self, caches, fetch: fetchImpl, URL, Request, Response, Promise, Date, Number, Math, console });
  vm.runInContext(source, context);
  const classify = context.classify as (r: { method: string; url: string; mode: string }, origin: string) => string | null;

  async function navigate(path: string) {
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: new NavRequest(`${ORIGIN}${path}`), respondWith: (r: Promise<Response>) => (response = r) });
    return response;
  }
  async function message(type: string) {
    let done: Promise<unknown> = Promise.resolve();
    handlers.message({ origin: ORIGIN, data: { type }, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  return { caches, classify, navigate, message };
}

/** A navigation request; Request in Node cannot be given mode "navigate". */
class NavRequest {
  method = "GET";
  mode = "navigate";
  constructor(public url: string) {}
}

const page = (body: string, init: ResponseInit & { redirected?: boolean } = {}) => {
  const r = new Response(body, { status: 200, headers: { Date: new Date().toUTCString() }, ...init });
  Object.defineProperty(r, "type", { value: "basic" });
  if (init.redirected) Object.defineProperty(r, "redirected", { value: true });
  return r;
};

describe("service worker", () => {
  let online: boolean;
  let served: Record<string, () => Response>;
  let sw: ReturnType<typeof load>;

  beforeEach(() => {
    online = true;
    served = {};
    sw = load(async (input) => {
      if (!online) throw new TypeError("Failed to fetch");
      const url = typeof input === "string" ? input : input.url;
      const make = served[new URL(url).pathname];
      return make ? make() : new Response("not found", { status: 404 });
    });
  });

  it("keeps the same pages the sign-in check protects", () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(sw.classify({ method: "GET", url: `${ORIGIN}${prefix}`, mode: "navigate" }, ORIGIN)).toBe("page");
    }
  });

  it("never keeps sign-in, the calendar feed, downloads, data requests or other sites", () => {
    const nav = (url: string, mode = "navigate", method = "GET") => sw.classify({ method, url, mode }, ORIGIN);
    expect(nav(`${ORIGIN}/sign-in`)).toBeNull();
    expect(nav(`${ORIGIN}/calendar/abc`)).toBeNull();
    expect(nav(`${ORIGIN}/dog/export`)).toBeNull();
    expect(nav(`${ORIGIN}/today`, "cors")).toBeNull();
    expect(nav(`${ORIGIN}/today`, "navigate", "POST")).toBeNull();
    expect(nav(`${ORIGIN}/todayx`)).toBeNull();
    expect(nav("https://example.com/today")).toBeNull();
    expect(nav(`${ORIGIN}/_next/static/chunks/a.js`, "no-cors")).toBe("static");
  });

  it("shows the kept copy of a page when there is no signal", async () => {
    served["/trends"] = () => page("trends then");
    expect(await (await sw.navigate("/trends"))!.text()).toBe("trends then");
    online = false;
    expect(await (await sw.navigate("/trends"))!.text()).toBe("trends then");
  });

  it("falls back to Today, then to a no-signal page", async () => {
    online = false;
    expect(await (await sw.navigate("/trends"))!.text()).toContain("No signal");
    online = true;
    served["/today"] = () => page("today then");
    await sw.navigate("/today");
    online = false;
    expect(await (await sw.navigate("/trends"))!.text()).toBe("today then");
  });

  it("deletes every kept page when a page redirects to sign-in", async () => {
    served["/today"] = () => page("today then");
    await sw.navigate("/today");
    served["/today"] = () => page("sign in", { redirected: true });
    await sw.navigate("/today");
    online = false;
    expect(await (await sw.navigate("/today"))!.text()).toContain("No signal");
  });

  it("deletes every kept page when asked to on sign-out", async () => {
    served["/today"] = () => page("today then");
    await sw.navigate("/today");
    await sw.message("clear");
    expect(await sw.caches.keys()).not.toContain("tailhelm-pages-v1");
  });

  it("fetches Today, the emergency card and vet visit ahead, but not when signed out", async () => {
    const fetched: string[] = [];
    served["/today"] = () => (fetched.push("today"), page("today"));
    served["/emergency"] = () => (fetched.push("emergency"), page("emergency"));
    served["/vet-visit"] = () => (fetched.push("vet-visit"), page("sign in", { redirected: true }));
    await sw.message("warm");
    const kept = await sw.caches.open("tailhelm-pages-v1");
    expect(await kept.match(`${ORIGIN}/emergency`)).toBeDefined();
    expect(await kept.match(`${ORIGIN}/vet-visit`)).toBeUndefined();
    // A recent copy is not fetched again.
    fetched.length = 0;
    await sw.message("warm");
    expect(fetched).toEqual(["vet-visit"]);
  });
});
