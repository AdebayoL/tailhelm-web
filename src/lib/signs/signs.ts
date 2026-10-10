import type { LocalDate } from "@/engine/time";
import type { ConditionPack } from "@/packs/schema";

/**
 * The quick check: the signs the pack lists, each a tap, saved together. A
 * saved check with no signs is a record too ("nothing noticed today").
 *
 * The pack's alert rule decides the words shown after a sign is logged. It
 * never interprets a sign; the only action it names is to tell the vet.
 */

export type Sign = { key: string; label: string };
export type SignsType = { key: string; name: string; signs: Sign[] };
export type SignsRule = { level: "amber" | "red"; ownerWording: string };

/** The pack's checklist: an observation type whose fields carry no unit. */
export function signsType(pack: ConditionPack | null): SignsType | null {
  const type = pack?.observationTypes.find((t) => t.fields.every((f) => !f.unit));
  return type ? { key: type.key, name: type.name, signs: type.fields.map((f) => ({ key: f.key, label: f.label })) } : null;
}

/** The pack's rule for a logged sign: one whose wording names the sign. */
export function signsRule(pack: ConditionPack | null): SignsRule | null {
  const rule = pack?.alertRules.find((r) => r.ownerWording.includes("{sign}"));
  return rule ? { level: rule.level, ownerWording: rule.ownerWording } : null;
}

/** The signs ticked on the form, in the pack's order, ignoring anything it doesn't list. */
export function parseSignsForm(form: FormData, type: SignsType): string[] {
  const ticked = new Set(form.getAll("sign").map(String));
  return type.signs.filter((s) => ticked.has(s.key)).map((s) => s.key);
}

const joinWords = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/** The pack's wording with the signs and date filled in, e.g. "You logged Vomiting and Weakness on 10 Oct 2026. Mention this to your vet." */
export function signsAlertText(
  rule: SignsRule,
  keys: string[],
  type: SignsType,
  date: LocalDate,
  formatDate: (d: LocalDate) => string,
): string | null {
  const labels = type.signs.filter((s) => keys.includes(s.key)).map((s) => s.label);
  if (labels.length === 0) return null;
  // Labels are sentence-case in the pack; mid-sentence they read lower-case after the first.
  const words = labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1)));
  return rule.ownerWording.replaceAll("{sign}", joinWords(words)).replaceAll("{date}", formatDate(date));
}
