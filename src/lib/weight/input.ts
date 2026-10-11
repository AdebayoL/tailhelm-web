import { type LocalDate, isLocalDate } from "@/engine/time";

/**
 * The weight log: what the scales said, in kilograms, and when. Tailhelm
 * states the numbers and the change between them; it never says whether a
 * weight or a change is good or bad.
 */

export const WEIGHT_TYPE = "weight";

export type WeightInput = { taken_on: LocalDate; kg: number; note: string | null };

const KG = /^\d{1,3}([.,]\d{1,2})?$/;

export function parseWeightForm(
  form: FormData,
  today: LocalDate,
): { ok: true; value: WeightInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const takenOn = String(form.get("taken_on") ?? "").trim();
  if (!isLocalDate(takenOn) || takenOn > today) errors.taken_on = "Enter the date you weighed them, today or earlier.";
  const raw = String(form.get("kg") ?? "").trim();
  const kg = Number(raw.replace(",", "."));
  if (!KG.test(raw) || kg <= 0 || kg > 120) errors.kg = "Enter the weight in kilograms, such as 24.6.";
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 200) errors.note = "Keep the note to 200 characters.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { taken_on: takenOn, kg, note: note || null } };
}

const kgText = (kg: number) => `${Number(kg.toFixed(2))} kg`;

/** "24.6 kg", then the change since the weight before it: "24.6 kg, up 0.4 kg since 3 Oct 2026." */
export function describeWeight(
  kg: number,
  previous: { kg: number; on: LocalDate } | null,
  formatDate: (d: LocalDate) => string,
): string {
  if (!previous) return `${kgText(kg)}.`;
  const change = Math.round((kg - previous.kg) * 100) / 100;
  if (change === 0) return `${kgText(kg)}, the same as on ${formatDate(previous.on)}.`;
  return `${kgText(kg)}, ${change > 0 ? "up" : "down"} ${kgText(Math.abs(change))} since ${formatDate(previous.on)}.`;
}
