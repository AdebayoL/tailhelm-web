import { describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import type { AdminClient } from "@/lib/supabase/admin";
import { runNoticed } from "./run";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

/**
 * Noticed's daily job end to end, against an in-memory stand-in for the
 * database that answers the queries it makes, so everything between is the
 * real code.
 */

type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

function fakeAdmin(db: Db, fail: string[] = []): AdminClient {
  let ids = 0;
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: { col: string; asc: boolean }[] = [];
    let window: [number, number] | null = null;
    let insert: Row | null = null;
    let one = false;
    const run = () => {
      if (fail.includes(table)) return { data: null, error: { message: "down" } };
      const rows = db[table] ?? (db[table] = []);
      if (insert) {
        const row = insert;
        if (table === "observations_noticed" && rows.some((r) => r.dog_id === row.dog_id && r.fingerprint === row.fingerprint))
          return { data: null, error: { code: "23505", message: "duplicate" } };
        rows.push({ id: `${table}-${++ids}`, ...row });
        return { data: null, error: null };
      }
      let found = rows.filter((r) => filters.every((f) => f(r)));
      found = [...found].sort((a, b) => {
        for (const { col, asc } of orders) {
          const c = String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1);
          if (c) return c;
        }
        return 0;
      });
      if (window) found = found.slice(window[0], window[1] + 1);
      return { data: one ? (found[0] ?? null) : found, error: null };
    };
    const q = {
      select: () => q,
      insert: (row: Row) => ((insert = row), q),
      eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
      in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), q),
      gte: (col: string, v: string) => (filters.push((r) => String(r[col]) >= v), q),
      or: (expr: string) => {
        const parts = expr.split(",").map((p) => p.split(".gte."));
        filters.push((r) => parts.some(([col, v]) => r[col] !== null && String(r[col]) >= v));
        return q;
      },
      order: (col: string, o?: { ascending?: boolean }) => (orders.push({ col, asc: o?.ascending ?? true }), q),
      range: (a: number, b: number) => ((window = [a, b]), q),
      maybeSingle: () => ((one = true), q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return q;
  };
  /** claim_noticed: active dogs with Noticed on, not yet looked at today. */
  const rpc = async (name: string, args: { today: string; how_many: number }) => {
    if (name !== "claim_noticed") throw new Error(name);
    const runs = db.noticed_runs ?? (db.noticed_runs = []);
    const due = db.dogs
      .filter((d) => d.status === "active" && !d.noticed_off)
      .filter((d) => {
        const r = runs.find((x) => x.dog_id === d.id);
        return !r || String(r.day) < args.today;
      })
      .slice(0, args.how_many);
    for (const d of due) {
      const r = runs.find((x) => x.dog_id === d.id);
      if (r) r.day = args.today;
      else runs.push({ dog_id: d.id, day: args.today });
    }
    return { data: due.map((d) => ({ dog_id: d.id })), error: null };
  };
  return { from, rpc } as unknown as AdminClient;
}

const lab = (id: string, on: string, ratio: number) => ({
  id,
  dog_condition_id: "addisons",
  type_key: "electrolytes",
  taken_at: `${on}T11:00:00Z`,
  values_json: { sodium: 140, potassium: Number((140 / ratio).toFixed(2)) },
  derived_json: { na_k_ratio: ratio },
});

function household(over: { plus?: boolean; noticedOff?: boolean; labs?: Row[] } = {}): Db {
  return {
    dogs: [{ id: "bella", name: "Bella", status: "active", noticed_off: over.noticedOff ?? false }],
    household_members: [
      { dog_id: "bella", profile_id: "sam", role: "owner", status: "active" },
      { dog_id: "bella", profile_id: "alex", role: "member", status: "active" },
    ],
    profiles: [
      { id: "sam", timezone: "Europe/London", plan_status: "free", plan_ends_at: null },
      { id: "alex", timezone: "Europe/London", plan_status: over.plus ? "plus" : "free", plan_ends_at: null },
    ],
    dog_conditions: [{ id: "addisons", dog_id: "bella", condition_key: "addisons" }],
    observations: over.labs ?? [lab("l1", "2026-10-01", 30.1), lab("l2", "2026-10-08", 28.4), lab("l3", "2026-10-15", 27.2)],
    events: [],
    anchors: [],
    observations_noticed: [],
    noticed_runs: [],
  };
}

const at = (iso: string) => new Date(iso);

describe("runNoticed", () => {
  it("waits until 04:00 UK time", async () => {
    const db = household();
    expect(await runNoticed(fakeAdmin(db), at("2026-10-25T02:30:00Z"))).toBeNull();
    expect(db.observations_noticed).toEqual([]);
  });

  it("saves what it finds with the rule and the records behind it", async () => {
    const db = household();
    expect(await runNoticed(fakeAdmin(db), at("2026-10-25T05:00:00Z"))).toEqual({ looked: 1, saved: 1, failed: 0 });
    const [row] = db.observations_noticed;
    expect(row).toMatchObject({
      dog_id: "bella",
      rule_family: "direction",
      rule_key: "na_k_ratio",
      computed_on: "2026-10-25",
      window_start: "2026-10-01",
      window_end: "2026-10-25",
      copy: "Bella’s Na:K ratio has fallen across the last 3 results: 30.1 on 1 Oct, 28.4 on 8 Oct and 27.2 on 15 Oct.",
    });
    const evidence = row.evidence_json as { rule: string; from: string | null; records: { id: string }[] };
    expect(evidence.from).toBe("2026-09-26");
    expect(evidence.records.map((r) => r.id)).toEqual(["l1", "l2", "l3"]);
  });

  it("looks at each dog once a day, and saves at most one a week", async () => {
    const db = household();
    const admin = fakeAdmin(db);
    await runNoticed(admin, at("2026-10-25T05:00:00Z"));
    expect(await runNoticed(admin, at("2026-10-25T05:05:00Z"))).toEqual({ looked: 0, saved: 0, failed: 0 });
    db.observations.push(lab("l4", "2026-10-26", 26.0), lab("l5", "2026-10-27", 25.1));
    // A new finding the next day still waits for the week to pass.
    expect(await runNoticed(admin, at("2026-10-28T05:00:00Z"))).toEqual({ looked: 1, saved: 0, failed: 0 });
    expect(await runNoticed(admin, at("2026-11-01T05:00:00Z"))).toEqual({ looked: 1, saved: 1, failed: 0 });
    expect(db.observations_noticed.map((r) => r.computed_on)).toEqual(["2026-10-25", "2026-11-01"]);
  });

  it("never saves the same finding twice", async () => {
    // On Plus, so the same three results are still read a week later.
    const db = household({ plus: true });
    const admin = fakeAdmin(db);
    await runNoticed(admin, at("2026-10-25T05:00:00Z"));
    expect(await runNoticed(admin, at("2026-11-02T05:00:00Z"))).toEqual({ looked: 1, saved: 0, failed: 0 });
  });

  it("reads only the last 30 days on free, and everything on Plus", async () => {
    const labs = [lab("l1", "2026-09-01", 30.1), lab("l2", "2026-09-10", 28.4), lab("l3", "2026-10-15", 27.2)];
    const free = household({ labs });
    await runNoticed(fakeAdmin(free), at("2026-10-25T05:00:00Z"));
    expect(free.observations_noticed).toEqual([]);
    const plus = household({ labs, plus: true });
    await runNoticed(fakeAdmin(plus), at("2026-10-25T05:00:00Z"));
    expect(plus.observations_noticed).toHaveLength(1);
    expect((plus.observations_noticed[0].evidence_json as { from: string | null }).from).toBeNull();
  });

  it("leaves alone a dog with Noticed switched off", async () => {
    const db = household({ noticedOff: true });
    expect(await runNoticed(fakeAdmin(db), at("2026-10-25T05:00:00Z"))).toEqual({ looked: 0, saved: 0, failed: 0 });
  });

  it("reports a dog it could not look at and carries on", async () => {
    const db = household();
    const run = await runNoticed(fakeAdmin(db, ["observations"]), at("2026-10-25T05:00:00Z"));
    expect(run).toEqual({ looked: 1, saved: 0, failed: 1 });
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
