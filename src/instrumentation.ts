import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring/sentry-options";

export function register() {
  Sentry.init(sentryOptions);
}

/** Reports errors thrown while rendering or in server actions. */
export const onRequestError = Sentry.captureRequestError;
