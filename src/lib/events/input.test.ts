import { describe, expect, it } from "vitest";
import { parseStressEventForm } from "./input";

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

describe("parseStressEventForm", () => {
  it("keeps what it is and its dates", () => {
    expect(parseStressEventForm(form({ title: " Kennels ", starts_on: "2026-10-16", ends_on: "2026-10-18" }))).toEqual({
      ok: true,
      value: { title: "Kennels", starts_on: "2026-10-16", ends_on: "2026-10-18" },
    });
  });

  it("treats a one-day event as having no end date", () => {
    const r = parseStressEventForm(form({ title: "Fireworks", starts_on: "2026-11-05", ends_on: "2026-11-05" }));
    expect(r.ok && r.value.ends_on).toBeNull();
  });

  it("needs a name, a start, and an end on or after the start", () => {
    const r = parseStressEventForm(form({ title: "", starts_on: "2026-10-16", ends_on: "2026-10-15" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["ends_on", "title"]);
  });
});
