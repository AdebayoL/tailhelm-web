/** The words shown while the phone has no signal. */

const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

export function offlineBannerText(savedAt: Date | null, now: Date): string {
  if (!savedAt) return "No signal. You’re seeing this page as it was when it was last loaded.";
  const sameDay = day.format(savedAt) === day.format(now);
  const when = sameDay ? `at ${time.format(savedAt)} today` : `at ${time.format(savedAt)} on ${day.format(savedAt)}`;
  return `No signal. You’re seeing this page as it was ${when}.`;
}
