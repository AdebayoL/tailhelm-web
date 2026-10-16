import "server-only";
import type { Notice } from "@/lib/reminders/due";
import type { AdminClient } from "@/lib/supabase/admin";

const UNIQUE_VIOLATION = "23505";

export type Channel = "push" | "email";
export type Outcome = "sent" | "no_device" | "failed" | "already_sent";

/**
 * Writes the delivery log row before anything is sent. Its unique key (person,
 * kind, reminder, channel) means a second run, or two runs at the same moment,
 * cannot send the same reminder to the same person on the same channel again.
 * Returns the row's id, or null when it was already sent.
 */
export async function logOnce(admin: AdminClient, profileId: string, dogId: string | null, notice: Notice, channel: Channel): Promise<string | null> {
  const { data, error } = await admin
    .from("notifications")
    .insert({
      profile_id: profileId,
      dog_id: dogId,
      kind: notice.kind,
      ref: notice.ref,
      channel,
      title: notice.title,
      scheduled_for: notice.at.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error?.code === UNIQUE_VIOLATION) return null;
  if (error || !data) throw new Error(`Could not log a notification: ${error?.message}`);
  return data.id;
}

/** Records how the send went. */
export async function logResult(admin: AdminClient, id: string, status: Exclude<Outcome, "already_sent">, problems: string[]): Promise<void> {
  await admin
    .from("notifications")
    .update({ status, sent_at: status === "sent" ? new Date().toISOString() : null, detail: problems.length ? problems.join("; ") : null })
    .eq("id", id);
}
