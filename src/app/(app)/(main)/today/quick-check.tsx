"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Icon } from "@/app/_components/icon";
import { saveCheck } from "./actions";

export type CheckRow = {
  key: string;
  label: string;
  /** "Sam, 08:05" or "You, 08:05" once ticked today. */
  by: string | null;
  mine: boolean;
};

/** Ticks not saved yet: sign key to ticked or not. Kept on the phone so leaving the page doesn't lose them. */
type Draft = Record<string, boolean>;

const DRAFT_EVENT = "tailhelm-check-draft";

function readDraft(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(storageKey: string, draft: Draft) {
  try {
    if (Object.keys(draft).length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Private browsing: the draft lives only as long as the page.
  }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(DRAFT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DRAFT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parseDraft(raw: string): Draft {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Draft) : {};
  } catch {
    return {};
  }
}

const joinWords = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/**
 * Today's check: the signs the condition pack lists. Ticks are gathered on
 * the card and saved together with the card's own Save button, which says
 * what was added to the day's notes for the vet.
 */
export function QuickCheck({
  conditionId,
  rows,
  day,
  storageKey,
}: {
  conditionId: string;
  rows: CheckRow[];
  /** The day the check is for, as "Sun 11 Oct". */
  day: string;
  storageKey: string;
}) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readDraft(storageKey),
    () => "",
  );
  const stored = parseDraft(raw);
  // A draft change that the saved check already matches is no change at all.
  const draft = Object.fromEntries(
    Object.entries(stored).filter(([key, on]) => {
      const row = rows.find((r) => r.key === key);
      return row && on !== (row.by !== null) && (on || row.mine);
    }),
  );
  const changes = Object.keys(draft).length;
  const [saving, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<{ at: number; added: string[]; removed: string[] } | null>(null);

  // Leaving with ticks not saved asks first; the ticks also stay on this phone.
  useEffect(() => {
    if (changes === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes]);

  const toggle = (row: CheckRow, on: boolean) => {
    setFailed(false);
    setSaved(null);
    const next = { ...draft };
    if (on === (row.by !== null)) delete next[row.key];
    else next[row.key] = on;
    writeDraft(storageKey, next);
  };

  const save = () => {
    const form = new FormData();
    form.set("dog_condition_id", conditionId);
    for (const [key, on] of Object.entries(draft)) form.append(on ? "add" : "remove", key);
    start(async () => {
      const result = await saveCheck(form).catch(() => ({ failed: true }) as const);
      if ("failed" in result && result.failed) {
        setFailed(true);
        return;
      }
      writeDraft(storageKey, {});
      setSaved({ at: Date.now(), added: result.added ?? [], removed: result.removed ?? [] });
    });
  };

  // Labels in the pack's order, whatever order they were ticked in.
  const labelsOf = (keys: string[]) => rows.filter((r) => keys.includes(r.key)).map((r) => r.label);
  const lower = (labels: string[]) => labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1)));
  const savedCount = rows.filter((r) => r.by !== null).length;

  return (
    <>
      <div className="checks">
        {rows.map((r) => {
          const savedOn = r.by !== null;
          const on = r.key in draft ? draft[r.key] : savedOn;
          const pending = r.key in draft;
          // Someone else's tick is theirs to undo.
          const locked = savedOn && !r.mine;
          return (
            <label key={r.key} className="check" style={locked ? { cursor: "default" } : undefined}>
              <input
                className="sr"
                type="checkbox"
                checked={on}
                disabled={locked || saving}
                onChange={(e) => toggle(r, e.target.checked)}
              />
              <span className={on ? (pending ? "box local" : "box on") : "box"}>
                <Icon name="boxTick" className={on ? "tick-in" : undefined} />
              </span>
              <span className="check-text">
                <span>{r.label}</span>
                {pending ? (
                  <span className="check-by is-pending">{on ? "Not saved yet" : "Taken off when you save"}</span>
                ) : (
                  savedOn && (
                    <span className="check-by">
                      <Icon name="tick" />
                      Noted · {r.by}
                    </span>
                  )
                )}
              </span>
            </label>
          );
        })}
      </div>

      {failed && (
        <p className="err" role="alert">
          <Icon name="attention" />
          This wasn&rsquo;t saved. Your ticks are still here, so try Save again in a minute.
        </p>
      )}

      <div className="check-foot">
        {changes > 0 ? (
          <>
            <button
              type="button"
              className={saving ? "btn btn-secondary is-loading" : "btn btn-secondary"}
              disabled={saving}
              onClick={save}
            >
              {saving && <span className="spin" aria-hidden="true" />}
              {saving ? "Saving…" : "Save today’s check"}
            </button>
            <p className="hint">
              {changes === 1 ? "1 change" : `${changes} changes`} on this card not saved yet.
            </p>
          </>
        ) : saved && (saved.added.length > 0 || saved.removed.length > 0) ? (
          <div className="banner banner-ok" role="status">
            <Icon name="tick" />
            <p>
              {saved.added.length > 0 && (
                <>
                  <b>Noted.</b> {joinWords(lower(labelsOf(saved.added)))} added to {day}&rsquo;s notes for your vet.
                </>
              )}
              {saved.added.length > 0 && saved.removed.length > 0 && " "}
              {saved.removed.length > 0 && (
                <>
                  {saved.added.length === 0 && <b>Saved. </b>}
                  {joinWords(lower(labelsOf(saved.removed)))} taken off.
                </>
              )}
            </p>
          </div>
        ) : (
          savedCount > 0 && (
            <p className="check-saved">
              <Icon name="tick" />
              Saved in {day}&rsquo;s notes for your vet.
            </p>
          )
        )}
      </div>
    </>
  );
}
