import { describe, expect, it } from "vitest";
import { parseDogProfile, telHref } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseDogProfile", () => {
  it("needs only a name", () => {
    expect(parseDogProfile(form({ name: "  Bella " }))).toEqual({
      ok: true,
      profile: { name: "Bella", vet_name: null, vet_phone: null, out_of_hours_phone: null, vet_email: null },
    });
  });

  it("asks for a name when it is blank", () => {
    expect(parseDogProfile(form({ name: "   " }))).toMatchObject({ ok: false, errors: { name: "Enter your dog's name." } });
  });

  it.each(["01632 960123", "+44 1632 960123", "(01632) 960-123", "07700 900123"])("accepts the UK number %s", (phone) => {
    expect(parseDogProfile(form({ name: "Bella", vet_phone: phone }))).toMatchObject({ ok: true });
  });

  it.each(["999", "1632 960123", "+1 555 0100", "call the surgery"])("rejects %s as a vet number", (phone) => {
    expect(parseDogProfile(form({ name: "Bella", vet_phone: phone }))).toMatchObject({
      ok: false,
      errors: { vet_phone: expect.any(String) },
    });
  });

  it("checks the vet's email and lower-cases it", () => {
    expect(parseDogProfile(form({ name: "Bella", vet_email: "nope" }))).toMatchObject({ ok: false });
    expect(parseDogProfile(form({ name: "Bella", vet_email: "Desk@Vets.co.uk" }))).toMatchObject({
      ok: true,
      profile: { vet_email: "desk@vets.co.uk" },
    });
  });
});

describe("telHref", () => {
  it.each([
    ["01632 960123", "tel:+441632960123"],
    ["+44 (0)1632 960123", "tel:+441632960123"],
    ["07700 900123", "tel:+447700900123"],
  ])("dials %s as %s", (phone, href) => {
    expect(telHref(phone)).toBe(href);
  });
});
