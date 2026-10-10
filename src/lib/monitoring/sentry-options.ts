/**
 * Sentry settings shared by the browser, server and edge. Errors only: no
 * performance tracing, no session replay, and no personal data (IP address,
 * cookies, request bodies), so a dog's records never leave in an error report.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
};
