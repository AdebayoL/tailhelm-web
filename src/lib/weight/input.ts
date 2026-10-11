import { type LocalDate, isLocalDate } from "@/engine/time";

/**
 * The weight log: what the scales said, in kilograms, and when. Tailhelm
 * states the numbers and the change between them; it never says whether a
 * weight or a change is good or bad.
 */

export const WEIGHT_TYPE = "weight";

/** Whose scale: scales differ, so the two are kept apart. */
export type Scale = "clinic" | "home";
export const SCALES: Scale[] = ["clinic", "home"];

export type WeightInput = { taken_on: LocalDate; kg: number; scale: Scale; note: string | null };

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
  const scale = String(form.get("scale") ?? "");
  if (!SCALES.includes(scale as Scale)) errors.scale = "Choose where they were weighed.";
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 200) errors.note = "Keep the note to 200 characters.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { taken_on: takenOn, kg, scale: scale as Scale, note: note || null } };
}

/** "24.0", "24.6", "8.25": kilograms to one decimal place, or two when the scales gave two. */
export function kgFigure(kg: number): string {
  return kg.toFixed(Math.round(kg * 100) % 10 === 0 ? 1 : 2);
}

const kgText = (kg: number) => `${kgFigure(kg)} kg`;

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

/**
 * The weight a vet reads first: the latest from the clinic's scale, else the
 * latest of any. Weights come latest first. "24.6 kg", "at clinic, 22 Sep 2026".
 */
export function vetWeight(
  weights: { kg: number; scale: Scale | null; on: LocalDate }[],
  formatDate: (d: LocalDate) => string,
): { kg: string; where: string; text: string } | null {
  const w = weights.find((x) => x.scale === "clinic") ?? weights[0];
  if (!w) return null;
  const kg = kgText(w.kg);
  const date = formatDate(w.on);
  const where = w.scale === "clinic" ? `at clinic, ${date}` : w.scale === "home" ? `on home scale, ${date}` : date;
  return { kg, where, text: w.scale ? `${kg} ${where}` : `${kg}, ${date}` };
}
