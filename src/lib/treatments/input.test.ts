import { describe, expect, it } from "vitest";
import { parseInjectionForm } from "./input";

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const ctx = { today: "2026-10-10", lastGivenOn: "2026-09-12" };
const base = {
  given_on: "2026-10-10",
  amount: "0.9",
  unit: "mL",
  given_by_who: "me",
  vial: "",
};

describe("parseInjectionForm", () => {
  it("keeps the amount exactly as entered", () => {
    expect(parseInjectionForm(form(base), ctx)).toEqual({
      ok: true,
      value: {
        given_on: "2026-10-10",
        amount: 0.9,
        unit: "mL",
        given_by: null,
        site: null,
        note: null,
        vial: null,
      },
    });
  });

  it("records someone outside the household by name", () => {
    const r = parseInjectionForm(
      form({ ...base, given_by_who: "someone_else", given_by: "Oak Vets" }),
      ctx,
    );
    expect(r.ok && r.value.given_by).toBe("Oak Vets");
    expect(
      parseInjectionForm(
        form({ ...base, given_by_who: "someone_else", given_by: "" }),
        ctx,
      ).ok,
    ).toBe(false);
  });

  it("refuses a future date, and a date on or before the last injection", () => {
    for (const given_on of [
      "2026-10-11",
      "2026-09-12",
      "2026-09-01",
      "not a date",
    ]) {
      const r = parseInjectionForm(form({ ...base, given_on }), ctx);
      expect(r.ok).toBe(false);
    }
    const r = parseInjectionForm(
      form({ ...base, given_on: "2026-09-12" }),
      ctx,
    );
    expect(!r.ok && r.errors.given_on).toBe(
      "An injection is already logged on 12 Sep 2026. Enter a later date.",
    );
  });

  it("allows the first injection on any past date", () => {
    expect(
      parseInjectionForm(form({ ...base, given_on: "2026-01-02" }), {
        ...ctx,
        lastGivenOn: null,
      }).ok,
    ).toBe(true);
  });

  it("needs a positive amount and a known unit", () => {
    for (const bad of [
      { amount: "" },
      { amount: "0" },
      { amount: "-1" },
      { amount: "1.2345" },
      { unit: "drops" },
    ]) {
      expect(parseInjectionForm(form({ ...base, ...bad }), ctx).ok).toBe(false);
    }
  });

  it("links an existing vial or records a new one", () => {
    expect(
      parseInjectionForm(form({ ...base, vial: "vial-1" }), ctx),
    ).toMatchObject({ ok: true, value: { vial: { id: "vial-1" } } });
    const r = parseInjectionForm(
      form({
        ...base,
        vial: "new",
        vial_batch: " AB12 ",
        vial_expires_on: "2027-06-30",
        vial_opened_on: "2026-10-10",
      }),
      ctx,
    );
    expect(r).toMatchObject({
      ok: true,
      value: {
        vial: {
          new: {
            batch: "AB12",
            expires_on: "2027-06-30",
            opened_on: "2026-10-10",
          },
        },
      },
    });
    expect(
      parseInjectionForm(
        form({ ...base, vial: "new", vial_opened_on: "2026-12-01" }),
        ctx,
      ).ok,
    ).toBe(false);
  });
});
