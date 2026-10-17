import "server-only";
import { toLocal } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { emailConfig } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { type CalendarFeed, type HealthIssue, healthIssues } from "./health";

/** What has stopped working in the signed-in person's reminders for one dog. */
export async function getReminderIssues(args: { dogId: string; dogName: string; me: string; timeZone: string; now: Date }): Promise<HealthIssue[]> {
  const supabase = await createClient();
  const [feeds, pushSent, phones, profile, lastEmail, monthlyTest] = await Promise.all([
    supabase.from("calendar_feeds").select("app, created_at, created_by, last_fetched_at").eq("dog_id", args.dogId).is("revoked_at", null),
    supabase.from("notifications").select("id").eq("channel", "push").eq("status", "sent").limit(1),
    supabase.from("push_subscriptions").select("last_test_ok_at"),
    supabase.from("profiles").select("email_reminders").eq("id", args.me).maybeSingle<{ email_reminders: boolean }>(),
    supabase
      .from("notifications")
      .select("status")
      .eq("channel", "email")
      .in("status", ["sent", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string }>(),
    supabase
      .from("notifications")
      .select("created_at")
      .eq("kind", "monthly_test")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
  ]);
  const failed = feeds.error ?? pushSent.error ?? phones.error ?? profile.error ?? lastEmail.error ?? monthlyTest.error;
  if (failed) {
    // The banner is a helper on Today; Today still opens without it.
    console.error("[reminders] health check failed", { message: failed.message });
    return [];
  }
  return healthIssues(
    {
      now: args.now,
      me: args.me,
      dogName: args.dogName,
      feeds: (feeds.data ?? []) as CalendarFeed[],
      pushEverSent: (pushSent.data ?? []).length > 0,
      pushPhones: (phones.data ?? []).length,
      monthlyTestAt: monthlyTest.data?.created_at ?? null,
      lastConfirmed:
        ((phones.data ?? []) as { last_test_ok_at: string | null }[])
          .map((p) => p.last_test_ok_at)
          .filter((at): at is string => !!at)
          .sort()
          .at(-1) ?? null,
      email: emailConfig() ? { on: profile.data?.email_reminders ?? true, lastFailed: lastEmail.data?.status === "failed" } : null,
    },
    (iso) => dayMonth(toLocal(new Date(iso), args.timeZone).date),
  );
}
