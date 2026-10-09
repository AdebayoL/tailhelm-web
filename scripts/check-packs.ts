import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePack } from "../src/packs/validate";

const root = join(import.meta.dirname, "..");
const register = JSON.parse(readFileSync(join(root, "sources/register.json"), "utf8"));
const packFiles = readdirSync(join(root, "packs")).filter((f) => f.endsWith(".pack.json"));

let failed = false;
for (const file of packFiles) {
  const pack = JSON.parse(readFileSync(join(root, "packs", file), "utf8"));
  const issues = validatePack(pack, register);
  if (issues.length > 0) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const issue of issues) console.error(`  ${issue.path}: ${issue.message}`);
  } else {
    console.log(`✓ ${file}`);
  }
}
if (packFiles.length === 0) console.log("No condition packs yet.");
process.exit(failed ? 1 : 0);
