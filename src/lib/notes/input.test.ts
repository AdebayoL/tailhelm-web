import { describe, expect, it } from "vitest";
import { parseNoteForm } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseNoteForm", () => {
  it("reads the day and the text", () => {
    expect(parseNoteForm(form({ on: "2026-10-11", text: "  Ate half his breakfast. " }), "2026-10-11")).toEqual({
      ok: true,
      value: { on: "2026-10-11", text: "Ate half his breakfast." },
    });
  });

  it("refuses an empty note and a future day", () => {
    const r = parseNoteForm(form({ on: "2026-10-12", text: " " }), "2026-10-11");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["on", "text"]);
  });

  it("refuses a note over 1000 characters", () => {
    expect(parseNoteForm(form({ on: "2026-10-11", text: "a".repeat(1001) }), "2026-10-11").ok).toBe(false);
  });
});
