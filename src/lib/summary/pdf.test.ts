import { describe, expect, it } from "vitest";
import { type Block, renderPdf, textWidth, toWinAnsi, wrap } from "./pdf";

const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");
const note = (text: string): Block => ({ kind: "line", runs: [{ text: "1 Oct 2026, Sam: ", bold: true }, { text }] });

describe("toWinAnsi", () => {
  it("keeps English, accents and the symbols a UK owner types, and marks anything else", () => {
    expect(toWinAnsi("Zoë’s café – £12 · 5°")).toBe("Zo\xeb\x92s caf\xe9 \x96 \xa312 \xb7 5\xb0");
    expect(toWinAnsi("Bella 🐶\tok")).toBe("Bella ? ok");
  });
});

describe("wrap", () => {
  it("breaks between words so no line is wider than the space", () => {
    const text = "A long note about the walk and what Bella ate, written to check that lines wrap at the margin.";
    const lines = wrap([{ text: "1 Oct: ", bold: true }, { text }], 200, 10);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(l.reduce((w, p) => w + textWidth(p.text, p.bold, 10), 0)).toBeLessThanOrEqual(200);
    expect(lines[0][0]).toEqual({ text: "1 Oct: ", bold: true });
    expect(lines.flat().map((p) => p.text).join(" ").replace(/\s+/g, " ")).toBe(`1 Oct: ${text}`);
  });

  it("starts a new line at a newline, and splits a word too wide for any line", () => {
    expect(wrap([{ text: "First\nSecond" }], 400, 10).map((l) => l.map((p) => p.text).join(""))).toEqual(["First", "Second"]);
    const long = wrap([{ text: `see ${"x".repeat(80)}` }], 100, 10);
    expect(long[0].map((p) => p.text).join("")).toBe("see");
    for (const l of long) expect(textWidth(l.map((p) => p.text).join(""), false, 10)).toBeLessThanOrEqual(100);
  });
});

describe("renderPdf", () => {
  const blocks: Block[] = [{ kind: "title", text: "Bella: 90-day summary" }, { kind: "heading", text: "Notes" }];
  for (let i = 0; i < 80; i++) blocks.push(note(`Note ${i} (with brackets) and a back\\slash.`));
  const file = ascii(renderPdf({ title: "Zoë: 90-day summary", footer: "Bella · prepared with Tailhelm", blocks }, new Date("2026-10-17T18:30:00Z")));

  it("is a PDF whose cross-reference table points at each object", () => {
    expect(file.startsWith("%PDF-1.4\n")).toBe(true);
    expect(file.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(file.match(/startxref\n(\d+)\n/)![1]);
    expect(file.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...file.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets.length).toBeGreaterThan(6);
    offsets.forEach((at, i) => expect(file.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it("runs onto as many A4 pages as it needs, each numbered", () => {
    const count = Number(file.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)![1]);
    expect(count).toBeGreaterThan(1);
    expect(file.match(/\/Type \/Page /g)).toHaveLength(count);
    expect(file).toContain(`(Page 1 of ${count}) Tj`);
    expect(file).toContain(`(Page ${count} of ${count}) Tj`);
    expect(file).toContain("/MediaBox [0 0 595.28 841.89]");
  });

  it("writes text with brackets and backslashes escaped, and the title in full", () => {
    expect(file).toContain("(Note 0 \\(with brackets\\) and a back\\\\slash.) Tj");
    expect(file).toContain("/Title <FEFF005A006F00EB003A");
    expect(file).toContain("(Bella \\267 prepared with Tailhelm) Tj");
  });

  it("keeps each stream's stated length", () => {
    for (const m of file.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      expect(file.slice(start + Number(m[1]), start + Number(m[1]) + 9)).toBe("endstream");
    }
  });
});
