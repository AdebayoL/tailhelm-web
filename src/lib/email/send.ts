import "server-only";
import { type Outcome, logOnce, logResult } from "@/lib/notify/log";
import type { Notice } from "@/lib/reminders/due";
import type { AdminClient } from "@/lib/supabase/admin";
import { reminderEmail } from "./message";

/**
 * Reminder emails, sent through Resend from the reminders address. Replies go
 * to the one address Tailhelm has.
 */
export type EmailConfig = { apiKey: string; from: string; replyTo: string };

export const REMINDERS_FROM = "Tailhelm <notifications@mail.tailhelm.com>";
export const REPLY_TO = "hello@tailhelm.com";

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, from: process.env.EMAIL_FROM?.trim() || REMINDERS_FROM, replyTo: REPLY_TO };
}

/** Emails one notice to one person, once (see logOnce). */
export async function deliverEmail(
  admin: AdminClient,
  config: EmailConfig,
  person: { id: string; email: string },
  dogId: string | null,
  notice: Notice,
  appUrl: string,
): Promise<Outcome> {
  const logged = await logOnce(admin, person.id, dogId, notice, "email");
  if (!logged) return "already_sent";
  const message = reminderEmail(notice, appUrl);
  let problem: string | null = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        // Resend drops a repeat of the same key, so a retried request is not a second email.
        "idempotency-key": logged,
      },
      body: JSON.stringify({ from: config.from, to: [person.email], reply_to: config.replyTo, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) problem = `email service ${response.status}`;
  } catch (error) {
    problem = String((error as Error).message ?? error).slice(0, 200);
  }
  const status = problem ? "failed" : "sent";
  await logResult(admin, logged, status, problem ? [problem] : []);
  return status;
}
