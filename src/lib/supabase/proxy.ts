import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "../auth/input";
import { supabaseEnv } from "./env";

/**
 * Refreshes the session cookie on every request and sends signed-out visitors
 * on protected routes to sign-in. This is an optimistic check only; pages and
 * actions verify the session again through the data access layer.
 */
export async function updateSession(request: NextRequest) {
  const env = supabaseEnv();
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  if (!env) {
    return protectedPath ? redirectToSignIn(request) : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Nothing may run between creating the client and this call, or sessions drop at random.
  const { data } = await supabase.auth.getClaims();

  if (protectedPath && !data?.claims) {
    const redirect = redirectToSignIn(request);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}
