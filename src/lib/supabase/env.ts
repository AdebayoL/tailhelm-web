/**
 * Supabase connection settings. Both are public by design: the publishable key
 * only grants what row-level security allows. Secret keys never live here.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: projectOrigin(url), key: key.trim() } : null;
}

/**
 * Supabase's dashboard shows the Data API address with `/rest/v1/` on the end.
 * The client needs the bare project address, so keep only the origin.
 */
export function projectOrigin(raw: string): string {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return raw.trim();
  }
}

export function requireSupabaseEnv(): { url: string; key: string } {
  const env = supabaseEnv();
  if (!env) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return env;
}
