"use client";

import { useActionState, useState } from "react";
import { subscribeLinks } from "@/lib/calendar/links";
import { type LinkState, makeCalendarLink } from "./actions";

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-lg bg-green px-4 py-3 text-center text-lg font-semibold text-paper disabled:opacity-60";
const secondary =
  "flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-green px-4 py-3 text-center text-lg font-semibold text-green";

/** Makes the calendar link and offers the ways to subscribe. The link shows only once. */
export function CalendarLink({ dogId, hasLive }: { dogId: string; hasLive: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(makeCalendarLink, {});
  const [copied, setCopied] = useState(false);

  if (state.url) {
    const links = subscribeLinks(state.url);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-semibold">Your link is ready. Add it to your calendar now: it shows only once.</p>
        <a href={links.apple} className={primary}>
          Add to Apple Calendar (iPhone, iPad, Mac)
        </a>
        <a href={links.google} target="_blank" rel="noopener noreferrer" className={secondary}>
          Add to Google Calendar
        </a>
        <button
          type="button"
          className={secondary}
          onClick={async () => {
            await navigator.clipboard.writeText(links.copy);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy the link (Outlook and others)"}
        </button>
        <p className="text-base">
          In Outlook, choose Add calendar, then Subscribe from web, and paste the link. Keep the link private: anyone
          with it can see the reminder times and medicine names.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="dog_id" value={dogId} />
      {state.failed && (
        <p role="alert" className="font-semibold">
          The link wasn&rsquo;t made. Try again in a minute.
        </p>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Making the link…" : hasLive ? "Make a new link (the old one stops)" : "Make my calendar link"}
      </button>
    </form>
  );
}
