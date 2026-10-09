import { z } from "zod";

/**
 * The condition pack format.
 *
 * A pack is the published layer for one condition: monitoring offsets, crisis
 * signs, alert and trend rules, schedule shapes. It never holds a dose. Doses,
 * times and cycle lengths belong to the prescribed layer, typed in by the owner
 * from their own vet's instructions.
 *
 * Every rule carries at least one citation into the source register.
 */

/** Evidence tiers, highest first. See "Where the rules come from" in the Build Spec. */
export const Tier = z.union([
  z.literal(1), // Regulatory product information (UK VMD SPCs, EMA)
  z.literal(2), // Specialist consensus guidelines (AAHA, IVETF, ACVIM)
  z.literal(3), // Peer-reviewed primary literature
  z.literal(4), // Reference texts: definitions and mechanisms only
]);
export type Tier = z.infer<typeof Tier>;

export const SourceEntry = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  publisher: z.string().min(1),
  edition: z.string().min(1),
  tier: Tier,
  url: z.url().optional(),
  doi: z.string().optional(),
  retrievedOn: z.iso.date(),
  /** Path to the stored copy, relative to the repo's sources/ directory. */
  storedCopy: z.string().optional(),
  /** Fixture sources exist only for tests and may never back a published pack. */
  testOnly: z.boolean().optional(),
});
export type SourceEntry = z.infer<typeof SourceEntry>;

export const SourceRegister = z.object({
  sources: z.array(SourceEntry),
});
export type SourceRegister = z.infer<typeof SourceRegister>;

export const Citation = z.object({
  sourceId: z.string().min(1),
  section: z.string().trim().min(1),
  sourceVersion: z.string().trim().min(1),
  tier: Tier,
  /** The passage relied on, so the vet can check the transcription side by side. */
  quote: z.string().trim().min(1),
});
export type Citation = z.infer<typeof Citation>;

const cited = { citations: z.array(Citation).min(1) };

export const ScheduleKind = z.enum(["fixed", "interval", "offset", "series", "event"]);
export type ScheduleKind = z.infer<typeof ScheduleKind>;

const Key = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** A medicine the condition uses. The pack names its schedule shape, never an amount. */
export const Medicine = z.object({
  key: Key,
  name: z.string().min(1),
  scheduleKind: ScheduleKind,
  /** An interval medicine whose administration starts a new cycle (e.g. DOCP). */
  setsAnchor: z.boolean().optional(),
  /** Window for interval medicines, in days. The owner's vet sets the actual interval. */
  windowDays: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).optional(),
  /** Variants of the condition this medicine applies to; omitted means all. */
  variants: z.array(Key).optional(),
  ...cited,
});

export const ObservationType = z.object({
  key: Key,
  name: z.string().min(1),
  fields: z
    .array(z.object({ key: Key, label: z.string().min(1), unit: z.string().optional() }))
    .min(1),
  ...cited,
});

/** Derived from observation fields only, e.g. Na:K ratio = sodium ÷ potassium. */
export const DerivedValue = z.object({
  key: Key,
  name: z.string().min(1),
  observationType: Key,
  operation: z.enum(["ratio", "difference"]),
  numerator: Key,
  denominator: Key,
  ...cited,
});

/** A test or task timed in days after the most recent anchor. */
export const MonitoringRule = z.object({
  key: Key,
  description: z.string().min(1),
  scheduleKind: z.enum(["offset", "series"]),
  offsetsDays: z.array(z.number().int().nonnegative()).optional(),
  observationType: Key.optional(),
  ...cited,
});

export const EventType = z.object({
  key: Key,
  name: z.string().min(1),
  ...cited,
});

export const CrisisSign = z.object({
  key: Key,
  label: z.string().min(1),
  /** Must lead to calling the vet. Attested by the reviewing vet. */
  alertWording: z.string().min(1),
  ...cited,
});

export const AlertRule = z.object({
  key: Key,
  level: z.enum(["amber", "red"]),
  description: z.string().min(1),
  ownerWording: z.string().min(1),
  ...cited,
});

export const TrendRule = z.object({
  key: Key,
  description: z.string().min(1),
  ownerWording: z.string().min(1),
  ...cited,
});

/** Tier 4 sources may back only definitions and mechanisms. */
export const Definition = z.object({
  key: Key,
  term: z.string().min(1),
  text: z.string().min(1),
  ...cited,
});

/** Two sources that disagree: both stored, the conservative one used, the owner told. */
export const Conflict = z.object({
  topic: z.string().min(1),
  citations: z.array(Citation).min(2),
  conservativeDefault: z.string().min(1),
  ownerWording: z.string().min(1),
});

export const Attestation = z.object({
  vetName: z.string().min(1),
  rcvsNumber: z.string().min(1),
  attestedOn: z.iso.date(),
  templateVersion: z.string().min(1),
});

export const ConditionPack = z.object({
  condition: Key,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  status: z.enum(["draft", "attested", "published"]),
  variants: z.array(Key).min(1),
  medicines: z.array(Medicine),
  observationTypes: z.array(ObservationType),
  derivedValues: z.array(DerivedValue),
  monitoringRules: z.array(MonitoringRule),
  events: z.array(EventType),
  crisisSigns: z.array(CrisisSign),
  alertRules: z.array(AlertRule),
  trendRules: z.array(TrendRule),
  definitions: z.array(Definition),
  conflicts: z.array(Conflict),
  /** Points no source covers. They become rules the app does not have. */
  openQuestions: z.array(z.string()),
  attestation: Attestation.optional(),
});
export type ConditionPack = z.infer<typeof ConditionPack>;
