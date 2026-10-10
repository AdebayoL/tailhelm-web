"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Shown only if the whole app fails to render. Reports the error and keeps the way to the vet open. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "28rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem" }}>Tailhelm couldn&rsquo;t load this screen.</h1>
        <p style={{ fontSize: "1.25rem" }}>If your dog is unwell, call your vet now.</p>
        <p style={{ fontSize: "1.25rem" }}>
          <a href="/emergency">Open the emergency screen</a>
        </p>
        <button type="button" onClick={() => retry()} style={{ fontSize: "1.25rem", minHeight: "3rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
