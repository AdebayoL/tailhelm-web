import { ConditionPack, SourceRegister, type Citation } from "./schema";

export type Issue = { path: string; message: string };

/**
 * Patterns that indicate a dose, a dose range or a formula producing one.
 * Deliberately broad: a false alarm costs a reword, a miss could cost a dog.
 */
const DOSE_TEXT_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\d+(?:[.,]\d+)?\s*(?:(?:-|–|to)\s*\d+(?:[.,]\d+)?\s*)?(?:mg|mcg|µg|μg|ml|mL|IU|iu|units?)\b/,
    reason: "an amount in a dose unit",
  },
  { pattern: /\/\s*kg\b|\bper\s+(?:kg|kilo(?:gram)?s?)\b/i, reason: "a per-bodyweight amount" },
  { pattern: /\b(?:give|administer|inject)\s+\d/i, reason: "an instruction to give an amount" },
  {
    pattern: /\b\d+(?:[.,]\d+)?\s*(?:-|–|to)?\s*\d*\s*(?:tablets?|capsules?|drops?|pumps?)\b/i,
    reason: "a counted amount of medicine",
  },
  { pattern: /\b(?:dosage|dose\s+of\s+\d|double\s+(?:the\s+)?dose|extra\s+dose)\b/i, reason: "dose wording" },
];

/** Keys that would let a pack carry an amount, wherever they appear. */
const DOSE_KEY = /dos(?:e|age)|amount|strength|per_?kg|perkg|mg_?kg/i;

export function findDoseContent(value: unknown, path = "$"): Issue[] {
  const issues: Issue[] = [];
  if (typeof value === "string") {
    for (const { pattern, reason } of DOSE_TEXT_PATTERNS) {
      if (pattern.test(value)) {
        issues.push({ path, message: `Contains ${reason}: "${value}"` });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => issues.push(...findDoseContent(item, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (DOSE_KEY.test(key)) {
        issues.push({ path: `${path}.${key}`, message: `Field name "${key}" could hold a dose` });
      }
      issues.push(...findDoseContent(child, `${path}.${key}`));
    }
  }
  return issues;
}

export function validatePack(rawPack: unknown, rawRegister: unknown): Issue[] {
  const register = SourceRegister.safeParse(rawRegister);
  if (!register.success) {
    return register.error.issues.map((i) => ({ path: `register.${i.path.join(".")}`, message: i.message }));
  }

  // The dose scan runs on the raw input so unknown fields cannot slip past the schema.
  const issues: Issue[] = findDoseContent(rawPack);

  const parsed = ConditionPack.safeParse(rawPack);
  if (!parsed.success) {
    return [
      ...issues,
      ...parsed.error.issues.map((i) => ({ path: `$.${i.path.join(".")}`, message: i.message })),
    ];
  }
  const pack = parsed.data;
  const sources = new Map(register.data.sources.map((s) => [s.id, s]));

  const checkCitations = (citations: Citation[], path: string, definitionOnly = false) => {
    citations.forEach((c, i) => {
      const source = sources.get(c.sourceId);
      const at = `${path}.citations[${i}]`;
      if (!source) {
        issues.push({ path: at, message: `Cites "${c.sourceId}", which is not in the source register` });
        return;
      }
      if (source.tier !== c.tier) {
        issues.push({ path: at, message: `Says tier ${c.tier} but "${c.sourceId}" is tier ${source.tier}` });
      }
      if (source.testOnly && pack.status !== "draft") {
        issues.push({ path: at, message: `"${c.sourceId}" is a test-only source and cannot back a pack marked ${pack.status}` });
      }
    });
    if (!definitionOnly && citations.every((c) => c.tier === 4)) {
      issues.push({
        path,
        message: "Cites only tier 4 reference texts, which may back definitions and mechanisms only",
      });
    }
  };

  const ruleGroups = [
    ["medicines", pack.medicines],
    ["observationTypes", pack.observationTypes],
    ["derivedValues", pack.derivedValues],
    ["monitoringRules", pack.monitoringRules],
    ["events", pack.events],
    ["crisisSigns", pack.crisisSigns],
    ["alertRules", pack.alertRules],
    ["trendRules", pack.trendRules],
  ] as const;

  for (const [group, rules] of ruleGroups) {
    const seen = new Set<string>();
    rules.forEach((rule, i) => {
      const path = `$.${group}[${i}]`;
      if (seen.has(rule.key)) issues.push({ path, message: `Duplicate key "${rule.key}"` });
      seen.add(rule.key);
      checkCitations(rule.citations, path);
    });
  }
  pack.definitions.forEach((d, i) => checkCitations(d.citations, `$.definitions[${i}]`, true));
  pack.conflicts.forEach((c, i) => checkCitations(c.citations, `$.conflicts[${i}]`));
  pack.changelog?.forEach((entry, i) => {
    for (const id of entry.sourceIds) {
      if (!sources.has(id)) issues.push({ path: `$.changelog[${i}]`, message: `Names "${id}", which is not in the source register` });
    }
  });

  // Schedule shapes.
  const anchors = pack.medicines.filter((m) => m.setsAnchor);
  pack.medicines.forEach((m, i) => {
    const path = `$.medicines[${i}]`;
    if (m.setsAnchor && m.scheduleKind !== "interval") {
      issues.push({ path, message: "Only an interval medicine can set the anchor" });
    }
    if (m.windowDays && m.windowDays.min > m.windowDays.max) {
      issues.push({ path, message: "Window minimum is after its maximum" });
    }
    for (const v of m.variants ?? []) {
      if (!pack.variants.includes(v)) issues.push({ path, message: `Unknown variant "${v}"` });
    }
  });

  const observationTypes = new Map(pack.observationTypes.map((o) => [o.key, o]));
  pack.monitoringRules.forEach((r, i) => {
    const path = `$.monitoringRules[${i}]`;
    if (r.scheduleKind === "offset" && anchors.length === 0) {
      issues.push({ path, message: "An offset rule needs a medicine that sets the anchor" });
    }
    if (r.scheduleKind === "offset" && !r.offsetsDays?.length) {
      issues.push({ path, message: "An offset rule needs at least one offset in days" });
    }
    if (r.observationType && !observationTypes.has(r.observationType)) {
      issues.push({ path, message: `Unknown observation type "${r.observationType}"` });
    }
  });

  pack.derivedValues.forEach((d, i) => {
    const path = `$.derivedValues[${i}]`;
    const obs = observationTypes.get(d.observationType);
    if (!obs) {
      issues.push({ path, message: `Unknown observation type "${d.observationType}"` });
      return;
    }
    for (const field of [d.numerator, d.denominator]) {
      if (!obs.fields.some((f) => f.key === field)) {
        issues.push({ path, message: `"${field}" is not a field of "${obs.key}"` });
      }
    }
  });

  if (pack.status !== "draft" && !pack.attestation) {
    issues.push({ path: "$.attestation", message: `A pack marked ${pack.status} needs a recorded vet attestation` });
  }

  return issues;
}
