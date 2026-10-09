import { z } from "zod";

/**
 * The dog's profile as the owner types it. Only the name is needed to start;
 * the vet's numbers feed the emergency screen's call buttons.
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

export const DogProfileInput = z.object({
  name: z.string().trim().min(1, "Enter your dog's name.").max(50, "Use 50 characters or fewer."),
  vet_name: optionalText(100),
  vet_phone: optionalPhone,
  out_of_hours_phone: optionalPhone,
  vet_email: optionalEmail,
});
export type DogProfileInput = z.infer<typeof DogProfileInput>;

export type FieldErrors = Partial<Record<keyof DogProfileInput, string>>;

const FIELDS = ["name", "vet_name", "vet_phone", "out_of_hours_phone", "vet_email"] as const;

export function parseDogProfile(
  form: FormData,
): { ok: true; profile: DogProfileInput } | { ok: false; errors: FieldErrors } {
  const raw = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "")]));
  const parsed = DogProfileInput.safeParse(raw);
  if (parsed.success) return { ok: true, profile: parsed.data };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof DogProfileInput;
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** A tel: link that dials from anywhere: +44 with the leading 0 dropped. */
export function telHref(phone: string): string {
  const d = digits(phone);
  return `tel:+44${(d.startsWith("44") ? d.slice(2) : d).replace(/^0/, "")}`;
}
