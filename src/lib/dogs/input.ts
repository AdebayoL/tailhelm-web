import { z } from "zod";
import { type Hours, parseHours } from "./hours";

/**
 * The dog's profile and vets as the owner types them. Only the name is needed
 * to start; the vets' numbers feed the emergency screen's call buttons.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** A UK phone number as people write it: digits, spaces, brackets and dashes, starting 0 or +44. */
function isUkPhone(value: string): boolean {
  if (!/^\+?[\d\s()-]+$/.test(value)) return false;
  const d = digits(value);
  if (value.startsWith("+")) return /^44(?:0?\d{10})$/.test(d);
  return /^0\d{9,10}$/.test(d);
}

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || isUkPhone(v), {
    message: "Enter a UK phone number, such as 01632 960123.",
  })
  .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Enter an email address, or leave it blank." })
  .transform((v) => (v === "" ? null : v.toLowerCase()));

export type FieldErrors = Record<string, string>;

function firstErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

const ProfileFields = z.object({
  name: z.string().trim().min(1, "Enter your dog's name.").max(50, "Use 50 characters or fewer."),
  breed: optionalText(60),
});

export type DogProfile = { name: string; breed: string | null; date_of_birth: string | null };

/**
 * The profile: the name, and optionally the breed and the month and year they
 * were born. The day is not asked; it is stored as the 1st and only the month
 * and year are ever shown.
 */
export function parseDogProfile(form: FormData, today: string): { ok: true; profile: DogProfile } | { ok: false; errors: FieldErrors } {
  const parsed = ProfileFields.safeParse({ name: String(form.get("name") ?? ""), breed: String(form.get("breed") ?? "") });
  const errors: FieldErrors = parsed.success ? {} : firstErrors(parsed.error.issues);
  const month = String(form.get("born_month") ?? "").trim();
  const year = String(form.get("born_year") ?? "").trim();
  let born: string | null = null;
  if (month || year) {
    const m = Number(month);
    born = /^\d{1,2}$/.test(month) && m >= 1 && m <= 12 && /^\d{4}$/.test(year) ? `${year}-${String(m).padStart(2, "0")}-01` : "";
    if (!born || born > today || year < "1990") errors.born = "Enter the month and year they were born, such as 3 and 2019, or leave both blank.";
  }
  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, profile: { ...parsed.data, date_of_birth: born } };
}

const VetFields = z.object({
  vet_name: optionalText(100),
  vet_phone: optionalPhone,
  vet_email: optionalEmail,
  out_of_hours_name: optionalText(100),
  out_of_hours_phone: optionalPhone,
});

export type DogVets = z.infer<typeof VetFields> & { vet_hours: Hours | null; out_of_hours_hours: Hours | null };

/** The dog's own vet and the out-of-hours service: names, numbers and the opening hours Emergency orders them by. */
export function parseDogVets(form: FormData): { ok: true; vets: DogVets } | { ok: false; errors: FieldErrors } {
  const raw = Object.fromEntries(["vet_name", "vet_phone", "vet_email", "out_of_hours_name", "out_of_hours_phone"].map((f) => [f, String(form.get(f) ?? "")]));
  const parsed = VetFields.safeParse(raw);
  const errors: FieldErrors = parsed.success ? {} : firstErrors(parsed.error.issues);
  const vetHours = parseHours(form, "vet_hours");
  const oohHours = parseHours(form, "ooh_hours");
  if (!vetHours.ok) errors.vet_hours = vetHours.error;
  if (!oohHours.ok) errors.ooh_hours = oohHours.error;
  if (!parsed.success || !vetHours.ok || !oohHours.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, vets: { ...parsed.data, vet_hours: vetHours.value, out_of_hours_hours: oohHours.value } };
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** A tel: link that dials from anywhere: +44 with the leading 0 dropped. */
export function telHref(phone: string): string {
  const d = digits(phone);
  return `tel:+44${(d.startsWith("44") ? d.slice(2) : d).replace(/^0/, "")}`;
}
