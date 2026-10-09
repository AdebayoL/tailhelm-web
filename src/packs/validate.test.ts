import { describe, expect, it } from "vitest";
import register from "./fixtures/test-register.json";
import stubCycle from "./fixtures/stub-cycle.pack.json";
import stubEpilepsy from "./fixtures/stub-epilepsy.pack.json";
import { findDoseContent, validatePack } from "./validate";

const clone = <T>(v: T): T => structuredClone(v);
const messages = (pack: unknown) => validatePack(pack, register).map((i) => i.message);

describe("validatePack", () => {
  it("accepts both stub packs, so one format serves different conditions", () => {
    expect(validatePack(stubCycle, register)).toEqual([]);
    expect(validatePack(stubEpilepsy, register)).toEqual([]);
  });

  it("rejects a rule with no citation", () => {
    const pack = clone(stubCycle);
    pack.crisisSigns[0].citations = [];
    expect(validatePack(pack, register).length).toBeGreaterThan(0);
  });

  it("rejects a citation with a blank section", () => {
    const pack = clone(stubCycle);
    pack.medicines[0].citations[0].section = "  ";
    expect(validatePack(pack, register).length).toBeGreaterThan(0);
  });

  it("rejects a citation to a source missing from the register", () => {
    const pack = clone(stubCycle);
    pack.medicines[0].citations[0].sourceId = "forum-post";
    expect(messages(pack)).toContain('Cites "forum-post", which is not in the source register');
  });

  it("rejects a citation whose tier does not match the register", () => {
    const pack = clone(stubCycle);
    pack.medicines[0].citations[0].tier = 2;
    expect(messages(pack)).toContain('Says tier 2 but "test-spc" is tier 1');
  });

  it("allows tier 4 sources for definitions but not for rules", () => {
    const pack = clone(stubCycle);
    pack.crisisSigns[0].citations = [clone(pack.definitions[0].citations[0])];
    expect(messages(pack)).toContain(
      "Cites only tier 4 reference texts, which may back definitions and mechanisms only",
    );
  });

  it("rejects an unsupported schedule kind", () => {
    const pack = clone(stubCycle) as { medicines: { scheduleKind: string }[] };
    pack.medicines[0].scheduleKind = "as_needed";
    expect(validatePack(pack, register).length).toBeGreaterThan(0);
  });

  it("rejects an offset rule when nothing sets the anchor", () => {
    const pack = clone(stubCycle);
    pack.medicines = pack.medicines.filter((m) => !m.setsAnchor);
    expect(messages(pack)).toContain("An offset rule needs a medicine that sets the anchor");
  });

  it("accepts an interval medicine with no published window, leaving the interval to the vet", () => {
    const pack = clone(stubCycle);
    delete (pack.medicines[1] as { windowDays?: unknown }).windowDays;
    expect(validatePack(pack, register)).toEqual([]);
  });

  it("rejects an attested pack without a recorded attestation", () => {
    const pack = { ...clone(stubCycle), status: "attested" };
    expect(messages(pack)).toContain("A pack marked attested needs a recorded vet attestation");
  });

  it("stops test-only sources backing a non-draft pack", () => {
    const pack = {
      ...clone(stubCycle),
      status: "attested",
      attestation: { vetName: "A Vet", rcvsNumber: "0000000", attestedOn: "2026-11-20", templateVersion: "1" },
    };
    expect(messages(pack).some((m) => m.includes("test-only source"))).toBe(true);
  });

  it("rejects a dose hidden in an extra field the schema does not know", () => {
    const pack = clone(stubCycle) as Record<string, unknown> & typeof stubCycle;
    (pack.medicines[0] as Record<string, unknown>).doseAmount = 2.5;
    expect(messages(pack)).toContain('Field name "doseAmount" could hold a dose');
  });
});

describe("findDoseContent", () => {
  const flagged = [
    "Prednisolone 2.5 mg once daily",
    "0.1 to 0.2 mg/kg",
    "2.2 mg per kg",
    "Give 2 tablets with food",
    "1-2 tablets twice a day",
    "Inject 0.5 ml",
    "10 IU twice daily",
    "Give a double dose if late",
    "Check the dosage",
  ];
  it.each(flagged)("flags %s", (text) => {
    expect(findDoseContent(text)).not.toEqual([]);
  });

  const allowed = [
    "Every 25 to 31 days",
    "Blood test around day 10 and day 25 after an injection",
    "Use within 120 days of opening",
    "Sodium 145 mmol/L",
    "This has lasted more than 5 minutes. This is an emergency. Call now.",
    "If a dose was missed, contact your vet.",
    "Na:K ratio",
  ];
  it.each(allowed)("allows %s", (text) => {
    expect(findDoseContent(text)).toEqual([]);
  });
});
