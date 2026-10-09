import { describe, expect, it } from "vitest";
import addisons from "../../packs/addisons.pack.json";
import { checkPackSeeded, packSeedSql } from "./pack-sql";
import { ConditionPack } from "./schema";

const pack = ConditionPack.parse(addisons);

describe("pack seed migrations", () => {
  it("accepts a migration that seeds this exact pack", () => {
    expect(checkPackSeeded(pack, [{ name: "seed.sql", sql: packSeedSql(pack) }])).toEqual([]);
  });

  it("fails when no migration seeds the pack", () => {
    expect(checkPackSeeded(pack, [])).toHaveLength(1);
  });

  it("fails when the pack changed without a new version", () => {
    const seeded = packSeedSql(pack);
    const changed = { ...pack, openQuestions: [...pack.openQuestions, "Another question"] };
    expect(checkPackSeeded(changed, [{ name: "seed.sql", sql: seeded }])[0].message).toMatch(/Bump the version/);
  });

  it("stores the whole pack as JSON", () => {
    const json = /\$pack\$([\s\S]*)\$pack\$/.exec(packSeedSql(pack))?.[1];
    expect(JSON.parse(json ?? "")).toEqual(pack);
  });
});
