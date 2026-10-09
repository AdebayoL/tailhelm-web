import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packSeedSql } from "../src/packs/pack-sql";
import { ConditionPack } from "../src/packs/schema";

// Writes a migration that seeds one condition pack version into the database.
const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run pack:migration -- packs/<condition>.pack.json");
  process.exit(1);
}
const pack = ConditionPack.parse(JSON.parse(readFileSync(file, "utf8")));
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const out = join(import.meta.dirname, "..", "supabase", "migrations", `${stamp}_seed_${pack.condition}_pack_${pack.version.replace(/\./g, "_")}.sql`);
writeFileSync(out, packSeedSql(pack));
console.log(`Wrote ${out}`);
