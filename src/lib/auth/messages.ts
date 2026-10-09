/** Owner-facing wording for sign-in problems. Plain, with the next step stated. */
export const MESSAGES = {
  badEmail: "Enter the email address you want to sign in with.",
  badCode: "Enter the 6-digit code from the email.",
  tooMany: "Too many codes have been sent to this address. Wait a few minutes, then ask for a new one.",
  wrongCode: "That code has expired or doesn't match. Check the latest email, or ask for a new code.",
  unavailable: "Sign-in isn't working right now. Try again in a few minutes.",
} as const;

/** Maps a Supabase Auth error code to owner-facing wording. */
export function messageForAuthError(code: string | undefined, step: "send" | "verify"): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return MESSAGES.tooMany;
    case "otp_expired":
    case "invalid_credentials":
      return MESSAGES.wrongCode;
    default:
      return step === "verify" ? MESSAGES.wrongCode : MESSAGES.unavailable;
  }
}
