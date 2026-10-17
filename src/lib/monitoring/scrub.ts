/**
 * Keeps keys out of error reports. An error can quote a key back, as one did
 * when a pasted key held a space and the request library refused it, quoting
 * the whole key in its message. Before a report leaves for Sentry, every
 * string in it is checked against the server's own secrets and the shapes
 * keys take, and any match is replaced.
 */

/** The environment variables that hold secrets. Public keys (NEXT_PUBLIC_*) are not secret. */
const SECRET_ENV = ["SUPABASE_SECRET_KEY", "CRON_SECRET", "VAPID_PRIVATE_KEY", "RESEND_API_KEY"] as const;

/** The shapes of keys this app uses, so a key is caught even when it is not this server's own. */
const KEY_SHAPES = [
  /sb_secret_[A-Za-z0-9_-]+/g, // Supabase secret key
  /\bre_[A-Za-z0-9_]{16,}/g, // Resend API key
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, // any bearer token
  /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // a signed token, such as an older Supabase key
];

/** Shorter pieces are left alone, so ordinary words are never hidden. */
const MIN_PIECE = 8;
const HIDDEN = "[hidden]";

/**
 * The secret values to look for: each whole value, and each piece of it
 * between spaces or line breaks, since that is how a pasted key arrives
 * broken. Longest first, so a whole key is replaced before its pieces.
 */
export function secretValues(env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env): string[] {
  const values = new Set<string>();
  for (const name of SECRET_ENV) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    for (const value of [raw, raw.replace(/\s+/g, ""), ...raw.split(/\s+/)]) {
      if (value.length >= MIN_PIECE) values.add(value);
    }
  }
  return [...values].sort((a, b) => b.length - a.length);
}

export function scrubText(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) out = out.split(secret).join(HIDDEN);
  for (const shape of KEY_SHAPES) out = out.replace(shape, HIDDEN);
  return out;
}

/** A copy of a report with every string scrubbed, however deep. */
export function scrubDeep<T>(value: T, secrets: string[], depth = 0): T {
  if (typeof value === "string") return scrubText(value, secrets) as T;
  if (depth > 20 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, secrets, depth + 1)) as T;
  // Only plain objects are copied; anything else, such as a date, is left as it is.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) out[key] = scrubDeep(v, secrets, depth + 1);
  return out as T;
}
