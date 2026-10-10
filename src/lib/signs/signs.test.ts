import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/plan/input";
import { getPack } from "@/packs/registry";
import { parseSignsForm, signsAlertText, signsRule, signsType } from "./signs";

const BANNED = /\b(safe|normal|fine|good|bad|healthy|streak|compliance)\b/i;
const pack = getPack("addisons");
const type = signsType(pack)!;
const rule = signsRule(pack)!;

function form(signs: string[]): FormData {
  const f = new FormData();
  for (const s of signs) f.append("sign", s);
  return f;
}

describe("quick check", () => {
  it("uses the pack's signs checklist, not the lab result", () => {
    expect(type.key).toBe("signs");
    expect(type.signs.map((s) => s.key)).toContain("vomiting");
  });

  it("uses the pack's amber rule for a logged sign", () => {
    expect(rule.level).toBe("amber");
  });

  it("keeps only the signs the pack lists, in its order", () => {
    expect(parseSignsForm(form(["weakness", "made_up", "vomiting"]), type)).toEqual(["vomiting", "weakness"]);
    expect(parseSignsForm(form([]), type)).toEqual([]);
  });

  it("fills in the pack's wording and points only to the vet", () => {
    const one = signsAlertText(rule, ["vomiting"], type, "2026-10-10", formatDate);
    const two = signsAlertText(rule, ["vomiting", "weakness", "panting"], type, "2026-10-10", formatDate);
    expect(one).toBe("You logged Vomiting on 10 Oct 2026. Mention this to your vet.");
    expect(two).toBe("You logged Vomiting, weakness and panting on 10 Oct 2026. Mention this to your vet.");
    expect(`${one} ${two}`).not.toMatch(BANNED);
  });

  it("says nothing when no sign was logged", () => {
    expect(signsAlertText(rule, [], type, "2026-10-10", formatDate)).toBeNull();
  });
});
