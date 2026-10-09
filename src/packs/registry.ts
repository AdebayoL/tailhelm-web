import addisons from "../../packs/addisons.pack.json";
import { ConditionPack } from "./schema";

/**
 * The condition packs the app ships with. Each version here is also seeded into
 * the database by a migration, which npm run check:packs confirms.
 */
export const PACKS: Record<string, ConditionPack> = {
  addisons: ConditionPack.parse(addisons),
};

export function getPack(conditionKey: string): ConditionPack | null {
  return PACKS[conditionKey] ?? null;
}

/** The medicines a pack lists for one variant of the condition. */
export function medicinesFor(pack: ConditionPack, variant: string | null) {
  return pack.medicines.filter((m) => !m.variants || (variant !== null && m.variants.includes(variant)));
}
