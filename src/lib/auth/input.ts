import { z } from "zod";

/** Where a signed-in owner lands when no other page was asked for. */
export const HOME_PATH = "/today";

/** Routes that need a signed-in owner. The proxy redirects; each page checks again. */
export const PROTECTED_PREFIXES = ["/today", "/trends", "/care-team", "/dog", "/emergency"] as const;

export const CODE_LENGTH = 6;

const Email = z.email().max(254);

/** Trims and lower-cases an email address, or returns null if it is not one. */
export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return Email.safeParse(email).success ? email : null;
}

/** Accepts a 6-digit code typed with spaces or dashes, as people copy it from email. */
export function parseCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) ? code : null;
}

/**
 * Returns a same-site path to continue to after sign-in, or the home path.
 * Anything that could leave the site (another origin, a protocol-relative URL,
 * a backslash trick) falls back to home.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return HOME_PATH;
  }
  try {
    const url = new URL(raw, "https://tailhelm.invalid");
    if (url.origin !== "https://tailhelm.invalid") return HOME_PATH;
    if (url.pathname === "/sign-in") return HOME_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return HOME_PATH;
  }
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
