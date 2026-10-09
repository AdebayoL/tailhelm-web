import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRegisterFiles } from "./register-files";

const dir = mkdtempSync(join(tmpdir(), "sources-"));
writeFileSync(join(dir, "doc.pdf"), "stored copy");
const sha256 = createHash("sha256").update("stored copy").digest("hex");

const entry = {
  id: "real-spc",
  title: "A real SPC",
  publisher: "VMD",
  edition: "Revised October 2025",
  tier: 1,
  retrievedOn: "2026-10-09",
  storedCopy: "doc.pdf",
  sha256,
};
const check = (sources: unknown[]) => checkRegisterFiles({ sources }, dir).map((i) => i.message);

describe("checkRegisterFiles", () => {
  it("accepts a stored copy whose hash matches", () => {
    expect(check([entry])).toEqual([]);
  });
  it("requires a stored copy for real sources", () => {
    expect(check([{ ...entry, storedCopy: undefined }])).toEqual(['"real-spc" needs a stored copy and its sha256']);
  });
  it("does not require one for test-only fixtures", () => {
    expect(check([{ ...entry, storedCopy: undefined, sha256: undefined, testOnly: true }])).toEqual([]);
  });
  it("reports a missing file", () => {
    expect(check([{ ...entry, storedCopy: "gone.pdf" }])).toEqual(['Stored copy "gone.pdf" is missing']);
  });
  it("reports a replaced file", () => {
    expect(check([{ ...entry, sha256: "0".repeat(64) }])).toEqual([
      'Stored copy "doc.pdf" does not match its recorded sha256',
    ]);
  });
  it("reports duplicate ids", () => {
    expect(check([entry, entry])).toContain('Duplicate source id "real-spc"');
  });
});
