import { z } from "zod";
import { type LocalDate, isLocalDate } from "@/engine/time";

/** A stressful event the owner plans for, such as kennels or fireworks: what it is and its dates. */
export type StressEventInput = { title: string; starts_on: LocalDate; ends_on: LocalDate | null };

export function parseStressEventForm(form: FormData): { ok: true; value: StressEventInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = z.string().trim().min(1).max(80).safeParse(form.get("title") ?? "");
  if (!title.success) errors.title = "Say what it is in a few words, such as Kennels or Fireworks.";
  const starts = String(form.get("starts_on") ?? "").trim();
  if (!isLocalDate(starts)) errors.starts_on = "Enter the date it starts.";
  const ends = String(form.get("ends_on") ?? "").trim();
  if (ends && (!isLocalDate(ends) || (isLocalDate(starts) && ends < starts))) {
    errors.ends_on = "Enter the date it ends, on or after the start, or leave it blank.";
  }
  if (Object.keys(errors).length > 0 || !title.success) return { ok: false, errors };
  return { ok: true, value: { title: title.data, starts_on: starts, ends_on: ends && ends !== starts ? ends : null } };
}
