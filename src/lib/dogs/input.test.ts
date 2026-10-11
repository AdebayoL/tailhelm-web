import { describe, expect, it } from "vitest";
import { parseDogProfile, parseDogVets, telHref } from "./input";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseDogProfile", () => {
  const TODAY = "2026-10-11";

  it("needs only a name", () => {
    expect(parseDogProfile(form({ name: "  Bella " }), TODAY)).toEqual({
      ok: true,
      profile: { name: "Bella", breed: null, date_of_birth: null },
    });
  });

  it("asks for a name when it is blank", () => {
    expect(parseDogProfile(form({ name: "   " }), TODAY)).toMatchObject({ ok: false, errors: { name: "Enter your dog's name." } });
  });

  it("keeps the breed and the month and year they were born", () => {
    expect(parseDogProfile(form({ name: "Bella", breed: "Standard Poodle", born_month: "3", born_year: "2019" }), TODAY)).toEqual({
      ok: true,
      profile: { name: "Bella", breed: "Standard Poodle", date_of_birth: "2019-03-01" },
    });
  });

  it.each([
    ["13", "2019"],
    ["3", "19"],
    ["", "2019"],
    ["11", "2026"],
    ["1", "1890"],
  ])("refuses born %s / %s", (born_month, born_year) => {
    expect(parseDogProfile(form({ name: "Bella", born_month, born_year }), TODAY)).toMatchObject({
      ok: false,
      errors: { born: expect.any(String) },
    });
  });
});

describe("parseDogVets", () => {
  it("leaves everything optional", () => {
    expect(parseDogVets(form({}))).toEqual({
      ok: true,
      vets: {
        vet_name: null,
        vet_phone: null,
        vet_email: null,
        out_of_hours_name: null,
        out_of_hours_phone: null,
        vet_hours: null,
        out_of_hours_hours: null,
      },
    });
  });

  it.each(["01632 960123", "+44 1632 960123", "(01632) 960-123", "07700 900123"])("accepts the UK number %s", (phone) => {
    expect(parseDogVets(form({ vet_phone: phone }))).toMatchObject({ ok: true });
  });

  it.each(["999", "1632 960123", "+1 555 0100", "call the surgery"])("rejects %s as a vet number", (phone) => {
    expect(parseDogVets(form({ out_of_hours_phone: phone }))).toMatchObject({
      ok: false,
      errors: { out_of_hours_phone: expect.any(String) },
    });
  });

  it("checks the vet's email and lower-cases it", () => {
    expect(parseDogVets(form({ vet_email: "nope" }))).toMatchObject({ ok: false });
    expect(parseDogVets(form({ vet_email: "Desk@Vets.co.uk" }))).toMatchObject({ ok: true, vets: { vet_email: "desk@vets.co.uk" } });
  });

  it("reads the opening hours, and says when a day has one time", () => {
    expect(parseDogVets(form({ vet_hours_0_open: "08:00", vet_hours_0_close: "19:00", ooh_hours_always: "on" }))).toMatchObject({
      ok: true,
      vets: { vet_hours: { week: [["08:00", "19:00"], null, null, null, null, null, null] }, out_of_hours_hours: { always: true } },
    });
    expect(parseDogVets(form({ vet_hours_3_close: "19:00" }))).toMatchObject({ ok: false, errors: { vet_hours: expect.any(String) } });
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
