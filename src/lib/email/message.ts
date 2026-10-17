import { HEALTH_KINDS, type Notice } from "@/lib/reminders/due";

/**
 * The words of a reminder email. Pure, so the wording is tested without
 * sending anything. The subject and first line are the notice itself, the same
 * words the phone shows; the rest is the link back, the backup reminder the
 * spec puts in every reminder email, and how to turn the emails off.
 *
 * Emails carry medicine names, times and dates, never a dose.
 */

export const EMAIL_FOOTER =
  "Tailhelm is a backup to your own routine. It is not a medical device and it does not replace your vet’s instructions. Always follow your vet’s plan, and call your vet if a dose is missed or you are worried.";

export type EmailMessage = { subject: string; text: string; html: string };

export function reminderEmail(notice: Notice, appUrl: string): EmailMessage {
  const open = new URL(notice.url, appUrl).toString();
  const settings = new URL("/reminders", appUrl).toString();
  const health = HEALTH_KINDS.has(notice.kind);
  const off = health
    ? "Tailhelm emails you when a reminder stops reaching you, even with reminder emails off."
    : "You get these emails because email reminders are on. You can turn them off in Reminders.";
  const text = [notice.title, "", notice.body, "", `Open Tailhelm: ${open}`, "", "—", EMAIL_FOOTER, "", health ? off : `${off} ${settings}`].join("\n");
  const html = `<!doctype html>
<html lang="en-GB">
<body style="margin:0;padding:0;background:#F5F7FA;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:'IBM Plex Sans',-apple-system,'Segoe UI',sans-serif;color:#182B3A;font-size:16px;line-height:24px;">
<p style="margin:0 0 24px;font-size:18px;font-weight:600;color:#17324D;">Tailhelm</p>
<div style="background:#FFFFFF;border:1px solid #D8E1E8;border-radius:12px;padding:24px;">
<h1 style="margin:0 0 8px;font-size:22px;line-height:30px;font-weight:600;">${escape(notice.title)}</h1>
<p style="margin:0 0 24px;">${escape(notice.body)}</p>
<a href="${escape(open)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#17324D;color:#FFFFFF;font-weight:600;text-decoration:none;">Open Tailhelm</a>
</div>
<p style="margin:24px 0 8px;font-size:14px;line-height:20px;color:#536575;">${escape(EMAIL_FOOTER)}</p>
<p style="margin:0;font-size:14px;line-height:20px;color:#536575;">${escape(off)}${health ? "" : ` <a href="${escape(settings)}" style="color:#17324D;">Reminders</a>`}</p>
</div>
</body>
</html>`;
  return { subject: notice.title, text, html };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
