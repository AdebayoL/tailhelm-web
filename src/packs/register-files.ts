import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SourceRegister } from "./schema";
import type { Issue } from "./validate";

/**
 * Checks the register against the files beside it: every real source has a
 * stored copy, the copy exists, and its hash matches the register.
 */
export function checkRegisterFiles(rawRegister: unknown, sourcesDir: string): Issue[] {
  const parsed = SourceRegister.safeParse(rawRegister);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({ path: `register.${i.path.join(".")}`, message: i.message }));
  }
  const issues: Issue[] = [];
  const seen = new Set<string>();
  parsed.data.sources.forEach((s, i) => {
    const path = `register.sources[${i}]`;
    if (seen.has(s.id)) issues.push({ path, message: `Duplicate source id "${s.id}"` });
    seen.add(s.id);
    if (s.testOnly) return;
    if (!s.storedCopy || !s.sha256) {
      issues.push({ path, message: `"${s.id}" needs a stored copy and its sha256` });
      return;
    }
    const file = join(sourcesDir, s.storedCopy);
    if (!existsSync(file)) {
      issues.push({ path, message: `Stored copy "${s.storedCopy}" is missing` });
      return;
    }
    const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (actual !== s.sha256) {
      issues.push({ path, message: `Stored copy "${s.storedCopy}" does not match its recorded sha256` });
    }
  });
  return issues;
}
