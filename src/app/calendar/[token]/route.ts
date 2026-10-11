import { createClient } from "@supabase/supabase-js";
import { type Feed, buildCalendar } from "@/lib/calendar/ics";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * The private calendar feed a calendar app subscribes to. No sign-in: the
 * random token in the link is the key, and only its hash is stored.
 */
export async function GET(_request: Request, ctx: RouteContext<"/calendar/[token]">) {
  const { token } = await ctx.params;
  const { url, key } = requireSupabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("calendar_feed", { token: token.replace(/\.ics$/, "") });
  if (error) {
    console.error("[calendar] feed failed", { code: error.code, message: error.message });
    return new Response("Try again later.", { status: 503, headers: { "Retry-After": "300" } });
  }
  if (!data) return new Response("Not found.", { status: 404 });
  return new Response(buildCalendar(data as Feed, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tailhelm.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
