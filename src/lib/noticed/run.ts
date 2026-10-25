import "server-only";
import * as Sentry from "@sentry/nextjs";
import { type LocalTime, toLocal, zonedTimeToInstant } from "@/engine/time";
import { HAPPENING_KIND } from "@/lib/happening/timer";
import { historyStart } from "@/lib/history/window";
import type { AdminClient } from "@/lib/supabase/admin";
import { allPages } from "@/lib/supabase/pages";
import { STRESS_EVENT_KIND } from "@/lib/today/past";
import { getPack } from "@/packs/registry";
import { type NoticedAnchorRow, type NoticedEventRow, type NoticedObservationRow, noticedInput, noticedTypeKeys } from "./records";
import { type Observation, chooseNoticed, dueForNoticed } from "./rules";

/** Each day, after this time in the UK, the scheduler looks at every dog's records once. */
export const NOTICED_AFTER: LocalTime = "04:00";
/** Dogs claimed at a time, and how long one run spends on them before leaving the rest to the next run. */
const BATCH = 10;
const BUDGET_MS = 15_000;
const UNIQUE_VIOLATION = "23505";
const FAILED = "Could not load the records for Noticed";

export type NoticedRun = { looked: number; saved: number; failed: number };

/**
 * Noticed's daily job, run from the reminder scheduler. Claims the dogs not
 * yet looked at today, a few at a time, and for each one due a new
 * observation saves the one Noticed chooses. A dog that fails is reported and
 * the rest carry on; it is looked at again tomorrow. Returns null before
 * 04:00 UK time, when there is nothing to do this run.
 */
export async function runNoticed(admin: AdminClient, now: Date): Promise<NoticedRun | null> {
  const uk = toLocal(now, "Europe/London");
  if (uk.time < NOTICED_AFTER) return null;
  const started = Date.now();
  const run: NoticedRun = { looked: 0, saved: 0, failed: 0 };
  while (Date.now() - started < BUDGET_MS) {
    const { data, error } = await admin.rpc("claim_noticed", { today: uk.date, how_many: BATCH });
    if (error) throw new Error(`Could not claim dogs for Noticed: ${error.message}`);
    const dogs = (data ?? []) as { dog_id: string }[];
    if (dogs.length === 0) break;
    for (const { dog_id } of dogs) {
      run.looked++;
      try {
        if (await noticeDog(admin, dog_id, now)) run.saved++;
      } catch (error) {
        run.failed++;
        console.error("[noticed] dog failed", { dogId: dog_id, message: (error as Error).message });
        Sentry.captureException(error, { extra: { dogId: dog_id } });
      }
    }
  }
  return run;
}

/** Looks at one dog's records and saves an observation if one is due and found. True when one was saved. */
async function noticeDog(admin: AdminClient, dogId: string, now: Date): Promise<boolean> {
  const [dog, members, saved, conditions] = await Promise.all([
    admin.from("dogs").select("name, status, noticed_off").eq("id", dogId).maybeSingle<{ name: string; status: string; noticed_off: boolean }>(),
    admin.from("household_members").select("profile_id, role").eq("dog_id", dogId).eq("status", "active"),
    admin.from("observations_noticed").select("fingerprint, computed_on").eq("dog_id", dogId).order("computed_on", { ascending: false }),
    admin.from("dog_conditions").select("id, condition_key").eq("dog_id", dogId).order("condition_key"),
  ]);
  const failed = dog.error ?? members.error ?? saved.error ?? conditions.error;
  if (failed) throw new Error(`${FAILED}: ${failed.message}`);
  if (!dog.data || dog.data.status !== "active" || dog.data.noticed_off) return false;
  const savedRows = (saved.data ?? []) as { fingerprint: string; computed_on: string }[];
  const memberRows = (members.data ?? []) as { profile_id: string; role: string }[];
  if (memberRows.length === 0) return false;

  const { data: people, error: peopleError } = await admin
    .from("profiles")
    .select("id, timezone, plan_status, plan_ends_at")
    .in("id", memberRows.map((m) => m.profile_id));
  if (peopleError) throw new Error(`${FAILED}: ${peopleError.message}`);
  const profiles = (people ?? []) as { id: string; timezone: string | null; plan_status: string | null; plan_ends_at: string | null }[];
  // The dog's day is the owner's, as for its reminders.
  const owner = memberRows.find((m) => m.role === "owner")?.profile_id;
  const timeZone = profiles.find((p) => p.id === owner)?.timezone || "Europe/London";
  const today = toLocal(now, timeZone).date;
  if (!dueForNoticed(savedRows[0]?.computed_on ?? null, today)) return false;

  // Plus as dog_has_plus decides it, which the scheduler cannot call: anyone active in the household has it.
  const plus = profiles.some((p) => p.plan_status === "plus" && (!p.plan_ends_at || new Date(p.plan_ends_at) > now));
  const from = historyStart(today, plus);
  const since = from && zonedTimeToInstant(from, "00:00", timeZone).toISOString();
  const seen = new Set(savedRows.map((r) => r.fingerprint));

  const events = await allPages<NoticedEventRow>(() => {
    const q = admin.from("events").select("id, kind, note, started_at, ended_at").eq("dog_id", dogId).in("kind", [HAPPENING_KIND, STRESS_EVENT_KIND]);
    return (since ? q.or(`started_at.gte.${since},ended_at.gte.${since}`) : q).order("started_at").order("id");
  }, FAILED);

  const rows = (conditions.data ?? []) as { id: string; condition_key: string }[];
  // With no condition, Happening now records can still be noticed.
  const targets = rows.length > 0 ? rows : [null];
  let found: Observation | null = null;
  for (const c of targets) {
    const pack = c ? getPack(c.condition_key) : null;
    const types = noticedTypeKeys(pack);
    const [observations, anchors] = c
      ? await Promise.all([
          types.length > 0
            ? allPages<NoticedObservationRow>(() => {
                const q = admin.from("observations").select("id, type_key, taken_at, values_json, derived_json").eq("dog_condition_id", c.id).in("type_key", types);
                return (since ? q.gte("taken_at", since) : q).order("taken_at").order("id");
              }, FAILED)
            : [],
          allPages<NoticedAnchorRow>(() => admin.from("anchors").select("anchored_on, cycle_no").eq("dog_condition_id", c.id).order("anchored_on").order("id"), FAILED),
        ])
      : [[], []];
    const input = noticedInput({ dogName: dog.data.name, pack, timeZone, today, from, observations, events, anchors });
    found = chooseNoticed(input, seen);
    if (found) break;
  }
  if (!found) return false;

  const { error } = await admin.from("observations_noticed").insert({
    dog_id: dogId,
    rule_family: found.family,
    rule_key: found.ruleKey,
    fingerprint: found.fingerprint,
    computed_on: today,
    window_start: found.windowStart,
    window_end: found.windowEnd,
    // The rule, the first day the records were read from (null for all of them) and the records it used.
    evidence_json: { rule: found.rule, from, records: found.records },
    copy: found.text,
  });
  if (error?.code === UNIQUE_VIOLATION) return false;
  if (error) throw new Error(`Could not save what Noticed found: ${error.message}`);
  return true;
}
