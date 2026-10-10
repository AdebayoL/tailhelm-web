import { type LocalDate, addMonths, daysBetween } from "@/engine/time";
import type { ConditionPack } from "@/packs/schema";

/**
 * The opened-vial warning. The number of months comes from the pack, where it
 * is cited to the product's label; this file only does the date arithmetic.
 */

/** The warning shows from this many days before the use-by date (spec, alert levels: amber within 14 days). */
export const VIAL_WARN_DAYS = 14;

export type VialRule = { months: number; ownerWording: string };

/** The pack's opened-vial rule, if it has one with a number of months. */
export function vialRule(pack: ConditionPack | null): VialRule | null {
  const rule = pack?.alertRules.find((r) => r.useWithinMonthsOfOpening !== undefined);
  return rule?.useWithinMonthsOfOpening ? { months: rule.useWithinMonthsOfOpening, ownerWording: rule.ownerWording } : null;
}

export type VialWarning = { openedOn: LocalDate; useBy: LocalDate; daysLeft: number };

/** The last day the opened vial may be used, as the label states it. */
export function discardDate(openedOn: LocalDate, rule: VialRule): LocalDate {
  return addMonths(openedOn, rule.months);
}

/** A warning once the vial is within VIAL_WARN_DAYS of its use-by date, or past it. */
export function vialWarning(openedOn: LocalDate | null, rule: VialRule | null, today: LocalDate): VialWarning | null {
  if (!openedOn || !rule) return null;
  const useBy = discardDate(openedOn, rule);
  const daysLeft = daysBetween(today, useBy);
  return daysLeft <= VIAL_WARN_DAYS ? { openedOn, useBy, daysLeft } : null;
}

/** The pack's wording with the dates filled in. */
export function vialWarningText(warning: VialWarning, rule: VialRule, formatDate: (d: LocalDate) => string): string {
  return rule.ownerWording
    .replaceAll("{opened_on}", formatDate(warning.openedOn))
    .replaceAll("{use_by}", formatDate(warning.useBy));
}
