import { type LocalDate, isLocalDate } from "@/engine/time";

/** A note the household keeps about the dog, such as feeding or behaviour, with the day it is about. */
export const NOTE_KIND = "note";

export type NoteInput = { on: LocalDate; text: string };

export function parseNoteForm(
  form: FormData,
  today: LocalDate,
): { ok: true; value: NoteInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const on = String(form.get("on") ?? "").trim();
  if (!isLocalDate(on) || on > today) errors.on = "Enter the day the note is about, today or earlier.";
  const text = String(form.get("text") ?? "").trim();
  if (text.length === 0) errors.text = "Write the note.";
  else if (text.length > 1000) errors.text = "Keep the note to 1000 characters.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { on, text } };
}
