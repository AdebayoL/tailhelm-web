import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { runReminders } from "@/lib/reminders/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanKey } from "@/lib/env/key";

/**
 * The reminder scheduler. Supabase calls this every 5 minutes (pg_cron with
 * pg_net, see supabase/setup/reminders-schedule.sql) with the shared secret.
 * Each reminder is sent once however often it runs, so a repeated or
 * overlapping call does no harm.
 */
export const maxDuration = 60;

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
  const admin = createAdminClient();
  if (!admin) {
    console.error("[reminders] SUPABASE_SECRET_KEY is not set");
    return Response.json({ ok: false, error: "not configured" }, { status: 503 });
  }
  const started = Date.now();
  try {
    // Links in reminder emails point back at the address the scheduler calls, unless APP_URL says otherwise.
    const appUrl = process.env.APP_URL?.trim() || new URL(request.url).origin;
    const summary = await runReminders(admin, new Date(), appUrl);
    console.info("[reminders] run", { ...summary, ms: Date.now() - started });
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[reminders] run failed", { message: (error as Error).message });
    Sentry.captureException(error);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
