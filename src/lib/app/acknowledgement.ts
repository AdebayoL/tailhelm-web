/**
 * The acknowledgement every owner ticks at setup (Build Spec, "Reminders").
 * It is recorded with the date and this version, so changing a word means a
 * new version and asking again.
 */
export const ACKNOWLEDGEMENT = {
  kind: "acknowledgement",
  version: "2026-10-09",
  text:
    "Tailhelm is a backup to your own routine. It is not a medical device and it does not replace your " +
    "vet’s instructions or your own checks. Reminders can fail: phones, calendars and email all fail " +
    "sometimes. Always follow your vet’s plan, keep your own routine, and call your vet if a dose is " +
    "missed or you are worried.",
} as const;
