"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Icon } from "@/app/_components/icon";
import { Wordmark } from "@/app/_components/mark";
import "./globals.css";

/** Shown only if the whole app fails to render. Reports the error and keeps the way to the vet open. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body>
        <main className="stack-24" style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
          <span className="wm">
            <Wordmark size={32} textStyle={{ fontSize: 26, lineHeight: "32px" }} />
          </span>
          <div className="stack-8" style={{ paddingTop: 24 }}>
            <h1 className="auth-title">Tailhelm couldn&rsquo;t load this screen</h1>
            <p className="ty-lead c2">If your dog is unwell, call your vet now.</p>
          </div>
          <a className="btn btn-emergency" href="/emergency">
            <Icon name="call" />
            Open the emergency screen
          </a>
          <button type="button" className="btn btn-secondary" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
