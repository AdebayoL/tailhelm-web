import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import type { AdminClient } from "@/lib/supabase/admin";
import { reconcileYesterday } from "./reconcile-run";
import { runReminders } from "./run";

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));

/**
 * The scheduler end to end, against an in-memory stand-in for the database
 * that answers the handful of queries it makes. Phones and email are faked
 * at the network edge, so everything between is the real code.
 */

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

/** The unique keys the scheduler relies on to send each reminder once. */
const UNIQUE: Record<string, string[]> = { notifications: ["profile_id", "kind", "ref", "channel"], reminder_checks: ["day"] };

/** `now` is the time rows are written at, as the database's own clock would stamp them. */
function fakeAdmin(db: Db, now: Date = new Date()): AdminClient {
  let ids = 0;
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    let window: [number, number] | null = null;
    let action: { kind: "select" } | { kind: "insert"; row: Row } | { kind: "update"; patch: Row } | { kind: "delete" } = { kind: "select" };
    let one = false;
    const value = (r: Row, col: string) => {
      if (!col.includes(".")) return r[col];
      const [rel, field] = col.split(".");
      return db[rel]?.find((x) => x.id === r[`${rel.replace(/s$/, "")}_id`])?.[field];
    };
    const run = () => {
      const rows = db[table] ?? (db[table] = []);
      if (action.kind === "insert") {
        const row: Row = { id: `${table}-${++ids}`, created_at: now.toISOString(), status: table === "notifications" ? "sending" : "running", ...action.row };
        const key = UNIQUE[table];
        if (key && rows.some((r) => key.every((k) => r[k] === row[k]))) return { data: null, error: { code: "23505", message: "duplicate" } };
        rows.push(row);
        return { data: one ? row : [row], error: null };
      }
      let found = rows.filter((r) => filters.every((f) => f(r)));
      if (action.kind === "update") {
        for (const r of found) Object.assign(r, action.patch);
        return { data: null, error: null };
      }
      if (action.kind === "delete") {
        db[table] = rows.filter((r) => !found.includes(r));
        return { data: null, error: null };
      }
      if (order) {
        const { col, asc } = order;
        found = [...found].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1));
      }
      if (window) found = found.slice(window[0], window[1] + 1);
      return { data: one ? (found[0] ?? null) : found, error: null };
    };
    const q = {
      select: () => q,
      insert: (row: Row) => ((action = { kind: "insert", row }), q),
      update: (patch: Row) => ((action = { kind: "update", patch }), q),
      delete: () => ((action = { kind: "delete" }), q),
      eq: (col: string, v: unknown) => (filters.push((r) => value(r, col) === v), q),
      in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(value(r, col))), q),
      gte: (col: string, v: string) => (filters.push((r) => String(value(r, col)) >= v), q),
      lte: (col: string, v: string) => (filters.push((r) => String(value(r, col)) <= v), q),
      like: (col: string, p: string) => (filters.push((r) => new RegExp(`^${p.replace(/%/g, ".*")}$`).test(String(value(r, col) ?? ""))), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), q),
      limit: (n: number) => ((window = [0, n - 1]), q),
      range: (a: number, b: number) => ((window = [a, b]), q),
      single: () => ((one = true), q),
      maybeSingle: () => ((one = true), q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return q;
  };
  return { from } as unknown as AdminClient;
}

const SAM = "sam";
const ALEX = "alex";

function household(over: { times?: string[]; alex?: boolean } = {}): Db {
  return {
    dogs: [{ id: "bella", name: "Bella", status: "active" }],
    household_members: [
      { dog_id: "bella", profile_id: SAM, role: "owner", status: "active" },
      ...(over.alex ? [{ dog_id: "bella", profile_id: ALEX, role: "member", status: "active" }] : []),
    ],
    profiles: [
      { id: SAM, email: "sam@example.com", timezone: "Europe/London", email_reminders: true },
      { id: ALEX, email: "alex@example.com", timezone: "Europe/London", email_reminders: false },
    ],
    push_subscriptions: [
      { id: "phone-1", profile_id: SAM, endpoint: "https://push.example.com/1", p256dh: "k", auth: "a", user_agent: "Mozilla/5.0 (iPhone)", last_test_ok_at: null },
    ],
    dog_conditions: [{ id: "addisons", dog_id: "bella" }],
    plan_items: [
      {
        id: "pred",
        product: "Prednisolone",
        schedule_json: { kind: "fixed", times: over.times ?? ["08:00"] },
        dog_condition_id: "addisons",
        active: true,
        created_at: "2026-10-01T09:00:00Z",
      },
    ],
    anchors: [],
    treatments: [],
    notifications: [],
    reminder_checks: [],
  };
}

/** One scheduler run at `at`. */
const runAt = (db: Db, at: string | number) => {
  const now = new Date(at);
  return runReminders(fakeAdmin(db, now), now, "https://tailhelm.com");
};

const sent = (db: Db) => db.notifications.map((n) => `${n.profile_id} ${n.channel} ${n.kind} ${n.ref} ${n.status}`).sort();

describe("runReminders", () => {
  let email: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    email = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", email);
    vi.mocked(webpush.sendNotification).mockReset().mockResolvedValue({} as never);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a dose reminder to the household's phones at its time, once however often it runs", async () => {
    const db = household();
    await runAt(db, "2026-10-13T07:00:00Z");
    await runAt(db, "2026-10-13T07:05:00Z");
    expect(sent(db)).toEqual(["sam push dose_due pred:2026-10-13:08:00 sent"]);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("still sends a late-evening dose's 2-hour reminder after midnight", async () => {
    const db = household({ times: ["23:00"] });
    await runAt(db, "2026-10-14T00:05:00Z");
    expect(sent(db)).toEqual(["sam email dose_not_ticked pred:2026-10-13:23:00 sent", "sam push dose_not_ticked pred:2026-10-13:23:00 sent"]);
  });

  it("sends the monthly test from 10:00 to someone who has never confirmed one", async () => {
    const db = household({ times: ["07:00"] });
    const tests = () => sent(db).filter((s) => s.includes("monthly_test"));
    await runAt(db, "2026-10-13T08:55:00Z");
    expect(tests()).toEqual([]);
    await runAt(db, "2026-10-13T09:00:00Z");
    await runAt(db, "2026-10-13T09:05:00Z");
    expect(tests()).toEqual(["sam push monthly_test 2026-10-13 sent"]);
  });

  it("emails the person once when their last phone stops getting notifications", async () => {
    const db = household();
    vi.mocked(webpush.sendNotification).mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await runAt(db, "2026-10-13T07:00:00Z");
    expect(db.push_subscriptions).toEqual([]);
    expect(db.notifications[0].detail).toBe("phone gone (410): iPhone");
    await runAt(db, "2026-10-13T07:05:00Z");
    await runAt(db, "2026-10-13T07:10:00Z");
    const lost = db.notifications.filter((n) => n.kind === "phone_lost");
    expect(lost.map((n) => [n.profile_id, n.channel, n.title, n.status])).toEqual([
      [SAM, "email", "Bella’s reminders can no longer reach your iPhone", "sent"],
    ]);
  });

  it("emails a person whose monthly test went unconfirmed for 2 days, even with reminder emails off", async () => {
    const db = household({ times: ["07:00"], alex: true });
    db.push_subscriptions.push({ id: "phone-2", profile_id: ALEX, endpoint: "https://push.example.com/2", p256dh: "k", auth: "a", user_agent: "Android", last_test_ok_at: "2026-10-13T09:00:00Z" });
    // Sam's test confirmed long ago; Alex has hers from today, so only Sam's is due.
    db.push_subscriptions[0].last_test_ok_at = "2026-09-01T09:00:00Z";
    await runAt(db, "2026-10-13T09:00:00Z");
    expect(sent(db).filter((s) => s.includes("monthly_test"))).toEqual(["sam push monthly_test 2026-10-13 sent"]);
    db.profiles[0].email_reminders = false;
    await runAt(db, "2026-10-15T08:55:00Z");
    expect(sent(db).filter((s) => s.includes("test_unconfirmed"))).toEqual([]);
    await runAt(db, "2026-10-15T09:05:00Z");
    expect(db.notifications.filter((n) => n.kind === "test_unconfirmed").map((n) => [n.profile_id, n.channel, n.title])).toEqual([
      [SAM, "email", "Bella’s reminders may not reach you"],
    ]);
  });
});

describe("reconcileYesterday", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    vi.mocked(webpush.sendNotification).mockReset().mockResolvedValue({} as never);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const checkAt = (db: Db, at: string) => reconcileYesterday(fakeAdmin(db, new Date(at)), new Date(at));

  const day = async (db: Db) => {
    // Every scheduler run of 13 Oct UK time, as pg_cron makes them.
    for (let t = Date.parse("2026-10-12T23:00:00Z"); t < Date.parse("2026-10-14T03:00:00Z"); t += 5 * 60 * 1000) {
      await runAt(db, t);
    }
  };

  it("waits until 04:00 UK time, then checks the day before once", async () => {
    const db = household();
    expect(await checkAt(db, "2026-10-14T02:55:00Z")).toBeNull();
    expect(await checkAt(db, "2026-10-14T03:00:00Z")).not.toBeNull();
    expect(await checkAt(db, "2026-10-14T03:05:00Z")).toBeNull();
    expect(db.reminder_checks.map((c) => [c.day, c.status])).toEqual([["2026-10-13", "done"]]);
  });

  it("finds no gap after a day the scheduler ran throughout", async () => {
    const db = household();
    await day(db);
    const check = await checkAt(db, "2026-10-14T03:00:00Z");
    expect(check).toMatchObject({ day: "2026-10-13", gaps: [] });
    expect(check!.expected).toBe(3); // the 08:00 reminder, the 2-hour one and the 21:00 email; nobody else to escalate to
  });

  it("names each reminder missed while the scheduler was down, and keeps them with the day", async () => {
    const db = household();
    await day(db);
    db.notifications = db.notifications.filter((n) => n.kind !== "dose_not_ticked");
    const check = await checkAt(db, "2026-10-14T03:00:00Z");
    expect(check!.gaps).toEqual([{ dogId: "bella", kind: "dose_not_ticked", ref: "pred:2026-10-13:08:00", problem: "not_sent" }]);
    expect(db.reminder_checks[0]).toMatchObject({ status: "done", expected: 3, not_sent: 1, not_delivered: 0 });
  });
});
