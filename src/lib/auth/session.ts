import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

export type Owner = { userId: string; email: string | null };

/** Verifies the signed-in owner against Supabase's signing keys, or sends them to sign in. */
export const requireOwner = cache(async (): Promise<Owner> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect("/sign-in");
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});
