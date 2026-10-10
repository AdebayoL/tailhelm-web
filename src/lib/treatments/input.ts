import { z } from "zod";
import { type LocalDate, isLocalDate } from "@/engine/time";
import { DOSE_UNITS, type FieldErrors, formatDate } from "@/lib/plan/input";

/**
 * An injection as the owner records it: what was given, when and by whom.
 * The amount starts filled in from the vet's plan so it is one tap to save,
 * and is stored exactly as entered. Nothing here works out an amount.
 */

export type InjectionInput = {
  given_on: LocalDate;
  amount: number;
  unit: (typeof DOSE_UNITS)[number];
  /** Someone outside the household, such as the vet practice. Null when it was the signed-in person. */
  given_by: string | null;
  site: string | null;
  note: string | null;
  vial:
    | { id: string }
    | {
        new: {
          batch: string | null;
          expires_on: LocalDate | null;
          opened_on: LocalDate | null;
        };
      }
    | null;
};

const text = (max: number) => z.string().trim().max(max);
const optional = (form: FormData, name: string, max: number) => {
  const parsed = text(max).safeParse(form.get(name) ?? "");
  return parsed.success ? parsed.data || null : undefined;
};

export function parseInjectionForm(
  form: FormData,
  { today, lastGivenOn }: { today: LocalDate; lastGivenOn: LocalDate | null },
): { ok: true; value: InjectionInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const givenOn = String(form.get("given_on") ?? "").trim();
  if (!isLocalDate(givenOn) || givenOn > today) {
    errors.given_on = "Enter the date it was given.";
  } else if (lastGivenOn && givenOn <= lastGivenOn) {
    errors.given_on = `An injection is already logged on ${formatDate(lastGivenOn)}. Enter a later date.`;
  }

  const amountRaw = String(form.get("amount") ?? "").trim();
  const amount = Number(amountRaw);
  if (!/^\d+(\.\d{1,3})?$/.test(amountRaw) || !(amount > 0))
    errors.amount = "Enter the amount given, as a number.";
  const unit = DOSE_UNITS.find((u) => u === form.get("unit"));
  if (!unit) errors.unit = "Choose the unit.";

  const by =
    form.get("given_by_who") === "someone_else"
      ? optional(form, "given_by", 80)
      : null;
  if (
    by === undefined ||
    (form.get("given_by_who") === "someone_else" && !by)
  ) {
    errors.given_by = "Enter who gave it, such as the vet practice.";
  }
  const site = optional(form, "site", 80);
  if (site === undefined) errors.site = "Use 80 characters or fewer.";
  const note = optional(form, "note", 500);
  if (note === undefined) errors.note = "Use 500 characters or fewer.";

  let vial: InjectionInput["vial"] = null;
  const vialChoice = String(form.get("vial") ?? "");
  if (vialChoice === "new") {
    const batch = optional(form, "vial_batch", 40);
    const expires = String(form.get("vial_expires_on") ?? "").trim();
    const opened = String(form.get("vial_opened_on") ?? "").trim();
    if (batch === undefined) errors.vial_batch = "Use 40 characters or fewer.";
    if (expires && !isLocalDate(expires))
      errors.vial_expires_on = "Enter the expiry date on the vial.";
    if (opened && (!isLocalDate(opened) || opened > today))
      errors.vial_opened_on = "Enter the date the vial was opened.";
    vial = {
      new: {
        batch: batch ?? null,
        expires_on: expires || null,
        opened_on: opened || null,
      },
    };
  } else if (vialChoice) {
    vial = { id: vialChoice };
  }

  if (Object.keys(errors).length > 0 || !unit) return { ok: false, errors };
  return {
    ok: true,
    value: {
      given_on: givenOn,
      amount,
      unit,
      given_by: by ?? null,
      site: site ?? null,
      note: note ?? null,
      vial,
    },
  };
}
