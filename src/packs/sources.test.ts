import { describe, expect, it } from "vitest";
import register from "../../sources/register.json";
import { citeLine } from "./sources";

describe("citeLine", () => {
  it("names the published source and the section a rule comes from", () => {
    const source = register.sources[0];
    const line = citeLine({ sourceId: source.id, section: "4.9", sourceVersion: source.edition, tier: 1, quote: "x" });
    expect(line).toBe(`Source: ${source.title}, 4.9.`);
  });

  it("shows nothing for a source the register doesn't hold", () => {
    expect(citeLine({ sourceId: "not-registered", section: "1", sourceVersion: "1", tier: 1, quote: "x" })).toBeNull();
  });
});
