import { describe, expect, it } from "vitest";
import { ACKNOWLEDGEMENT } from "./acknowledgement";

const BANNED = ["safe", "normal", "fine", "streak", "compliance", "administer", "dosage"];

describe("acknowledgement", () => {
  it("says the app is not a medical device and points to the vet", () => {
    expect(ACKNOWLEDGEMENT.text).toContain("not a medical device");
    expect(ACKNOWLEDGEMENT.text).toContain("call your vet");
  });

  it("carries a dated version so a wording change asks again", () => {
    expect(ACKNOWLEDGEMENT.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses none of the banned words", () => {
    for (const word of BANNED) expect(ACKNOWLEDGEMENT.text.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});
