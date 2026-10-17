import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { reconcileYesterday } from "@/lib/reminders/reconcile-run";
import { runReminders } from "@/lib/reminders/run";
import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import { cleanKey } from "@/lib/env/key";

/**
 * The reminder scheduler. Supabase calls this every 5 minutes (pg_cron with
 * pg_net, see supabase/setup/reminders-schedule.sql) with the shared secret.
 * Each reminder is sent once however often it runs, so a repeated or
 * overlapping call does no harm.
 *
 * Every run checks in with Sentry, which alerts the founder when runs stop
 * arriving or keep failing. Once a day a run also reconciles the day before.
 */
export const maxDuration = 60;

const MONITOR = "reminder-scheduler";
/** Sentry raises an alert after 3 missed or failed runs in a row, about 20 minutes (spec: within 30). */
const MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "*/5 * * * *" },
  checkinMargin: 5,
  maxRuntime: 2,
  timezone: "Etc/UTC",
  failureIssueThreshold: 3,
  recoveryThreshold: 1,
};

function authorised(request: Request): boolean {
  const secret = cleanKey(process.env.CRON_SECRET);
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorised(request)) return new Response("Not found.", { status: 404 });
  const checkInId = Sentry.captureCheckIn({ monitorSlug: MONITOR, status: "in_progress" }, MONITOR_CONFIG);
  const started = Date.now();
  const finish = async (status: "ok" | "error", response: Response) => {
    Sentry.captureCheckIn({ checkInId, monitorSlug: MONITOR, status, duration: (Date.now() - started) / 1000 });
    // The function can stop as soon as it answers, so the check-in and any report are sent first.
    await Sentry.flush(2000);
    return response;
  };

  const admin = createAdminClient();
  if (!admin) {
    console.error("[reminders] SUPABASE_SECRET_KEY is not set");
    return finish("error", Response.json({ ok: false, error: "not configured" }, { status: 503 }));
  }
  const now = new Date();
  try {
    // Links in reminder emails point back at the address the scheduler calls, unless APP_URL says otherwise.
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const summary = await runReminders(admin, now, appUrl);
    console.info("[reminders] run", { ...summary, ms: Date.now() - started });
    await reconcile(admin, now);
    return finish("ok", Response.json({ ok: true, ...summary }));
  } catch (error) {
    console.error("[reminders] run failed", { message: (error as Error).message });
    Sentry.captureException(error);
    return finish("error", Response.json({ ok: false }, { status: 500 }));
  }
}

/** The daily reconciliation. Its failure is reported but never fails the run, whose reminders have already gone. */
async function reconcile(admin: AdminClient, now: Date) {
  try {
    const check = await reconcileYesterday(admin, now);
    if (!check) return;
    const notSent = check.gaps.filter((g) => g.problem === "not_sent").length;
    const notDelivered = check.gaps.length - notSent;
    console.info("[reminders] daily check", { day: check.day, expected: check.expected, notSent, notDelivered });
    if (check.gaps.length > 0) {
      Sentry.captureMessage(`Reminders on ${check.day}: ${notSent} not sent, ${notDelivered} reached nobody`, {
        level: "warning",
        extra: { day: check.day, expected: check.expected, gaps: check.gaps.slice(0, 20) },
      });
    }
  } catch (error) {
    console.error("[reminders] daily check failed", { message: (error as Error).message });
    Sentry.captureException(error);
  }
}

export const GET = run;
export const POST = run;
