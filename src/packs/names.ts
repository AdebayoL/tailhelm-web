/** Names shown to owners. A condition gets one here when its first pack is written. */
export const CONDITION_NAMES: Record<string, string> = {
  addisons: "Addison's disease",
};

/** The medical name a vet reads beside it, as the pack's sources use it. */
export const CONDITION_MEDICAL_NAMES: Record<string, string> = {
  addisons: "hypoadrenocorticism",
};

/** The short name in "Tailhelm for Addison's". */
export const CONDITION_SHORT_NAMES: Record<string, string> = {
  addisons: "Addison's",
};

export const conditionName = (key: string) => CONDITION_NAMES[key] ?? key;
export const conditionShortName = (key: string) => CONDITION_SHORT_NAMES[key] ?? conditionName(key);
export const conditionMedicalName = (key: string): string | null => CONDITION_MEDICAL_NAMES[key] ?? null;
