import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

Sentry.init(sentryOptions);

/**
 * Page counts only, with no cookies or browser storage, no autocapture of
 * clicks or form fields, no session recording and no person profiles. Each
 * page view is anonymous, so no cookie banner is needed for it.
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey && process.env.NODE_ENV === "production") {
  try {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      persistence: "memory",
      person_profiles: "never",
      autocapture: false,
      capture_pageview: "history_change",
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      ip: false,
    });
  } catch {
    // Analytics must never stop the app from working.
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
