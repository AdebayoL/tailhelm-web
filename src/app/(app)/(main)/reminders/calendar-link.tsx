"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/app/_components/icon";
import { Sheet } from "@/app/_components/sheet";
import { subscribeLinks } from "@/lib/calendar/links";
import { type LinkState, makeCalendarLink } from "./actions";

const NAMES = { apple: "Apple Calendar", google: "Google Calendar", other: "your calendar" } as const;

function Failed() {
  return (
    <p className="err" role="alert">
      <Icon name="attention" />
      The link wasn&rsquo;t made. Try again in a minute.
    </p>
  );
}

/**
 * Makes a link for Apple or Google Calendar, then opens that calendar to subscribe. The link shows once.
 * It stays mounted once the link exists (`linked`), so the sheet survives the page refreshing.
 */
export function AddCalendar({ dogId, app, linked }: { dogId: string; app: "apple" | "google"; linked: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(makeCalendarLink, {});
  // The sheet opens with each new link and stays closed once dismissed.
  const [closed, setClosed] = useState<string | null>(null);
  const open = !!state.url && state.url !== closed;
  const close = () => setClosed(state.url ?? null);
  const links = state.url ? subscribeLinks(state.url) : null;
  return (
    <>
      {!linked && (
        <form action={action} className="stack-8">
          <input type="hidden" name="dog_id" value={dogId} />
          <input type="hidden" name="app" value={app} />
          {state.failed && <Failed />}
          <button type="submit" disabled={pending} className={pending ? "btn btn-secondary is-loading" : "btn btn-secondary"}>
            {pending ? <span className="spin" aria-hidden="true" /> : <Icon name="calendar" />}
            {pending ? "Making the link…" : `Add to ${NAMES[app]}`}
          </button>
        </form>
      )}
      {open && links && (
        <Sheet label={`Add to ${NAMES[app]}`} onClose={close}>
          <h2 className="ty-page">Add to {NAMES[app]}</h2>
          <p>
            {app === "apple"
              ? "Your iPhone, iPad or Mac asks whether to subscribe. Say yes, and each dose time and injection date appears with an alarm."
              : "Google Calendar opens in a new tab and asks whether to add the calendar. Say yes, and it appears on every device signed in to that Google account."}
          </p>
          <a
            className="btn btn-primary"
            href={app === "apple" ? links.apple : links.google}
            target={app === "google" ? "_blank" : undefined}
            rel={app === "google" ? "noopener noreferrer" : undefined}
            onClick={close}
          >
            <Icon name="calendar" />
            Open {NAMES[app]}
          </a>
          <p className="hint">This link opens once. To add it again later, make a new one; the old one stops.</p>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}

/** A link for Outlook or any other calendar, shown once to copy. */
export function CopyCalendarLink({ dogId, hasLive }: { dogId: string; hasLive: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(makeCalendarLink, {});
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button type="button" className="lnk" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        <Icon name="copy" size={20} />
        Copy calendar link
      </button>
      {open && (
        <Sheet label="Copy calendar link" onClose={() => setOpen(false)}>
          <h2 className="ty-page">Copy calendar link</h2>
          {state.url ? (
            <>
              <p>Your link is ready. Copy it now: it shows only once.</p>
              <input className="inp tn" readOnly value={state.url} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.url!);
                  setCopied(true);
                }}
              >
                <Icon name="copy" />
                {copied ? "Copied" : "Copy the link"}
              </button>
              <p className="hint">
                In Outlook, choose Add calendar, then Subscribe from web, and paste the link. Keep it private: anyone with it can see the
                medicine names and reminder times, never a dose.
              </p>
            </>
          ) : (
            <form action={action} className="stack-16">
              <input type="hidden" name="dog_id" value={dogId} />
              <input type="hidden" name="app" value="other" />
              <p>
                A private link for Outlook or any other calendar.
                {hasLive && " Making a new one stops the copied link you made before."}
              </p>
              {state.failed && <Failed />}
              <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
                {pending && <span className="spin" aria-hidden="true" />}
                {pending ? "Making the link…" : "Make the link"}
              </button>
            </form>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}
