import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";
import { cleanKey } from "@/lib/env/key";

/**
 * A Supabase client with the secret key, for the reminder scheduler and for
 * telling the household about a tick. It bypasses row-level security, so it is
 * used only on the server and only for what those two jobs need. Null when the
 * secret key is not set, so the rest of the app works without it.
 */
export function createAdminClient() {
  const env = supabaseEnv();
  const secret = cleanKey(process.env.SUPABASE_SECRET_KEY);
  if (!env || !secret) return null;
  return createClient(env.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
