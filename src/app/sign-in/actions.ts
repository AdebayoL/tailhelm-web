"use server";

import { redirect } from "next/navigation";
import { parseCode, parseEmail, safeNext } from "@/lib/auth/input";
import { MESSAGES, messageForAuthError } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  step: "email" | "code";
  email: string;
  next: string;
  error?: string;
  /** Changes each time a code is sent, so the form can say so. */
  sentAt?: number;
};

export async function signInStep(state: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNext(formData.get("next") ?? state.next);
  const intent = formData.get("intent");

  if (intent === "change-email") {
    return { step: "email", email: state.email, next };
  }

  if (state.step === "email" || intent === "resend") {
    const email = intent === "resend" ? parseEmail(state.email) : parseEmail(formData.get("email"));
    if (!email) {
      const typed = String(formData.get("email") ?? "").trim();
      return { step: "email", email: typed, next, error: typed ? MESSAGES.badEmail : MESSAGES.noEmail };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      logAuthError("send", error);
      const message = messageForAuthError(error.code, "send");
      return intent === "resend" ? { ...state, next, error: message } : { step: "email", email, next, error: message };
    }
    return { step: "code", email, next, sentAt: Date.now() };
  }

  const email = parseEmail(state.email);
  if (!email) return { step: "email", email: "", next, error: MESSAGES.badEmail };

  const token = parseCode(formData.get("code"));
  if (!token) return { ...state, next, error: MESSAGES.badCode };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    logAuthError("verify", error);
    return { ...state, next, error: messageForAuthError(error.code, "verify") };
  }

  redirect(next);
}

/** Logs why Supabase refused, for Vercel's logs. Never the email address or the code. */
function logAuthError(step: "send" | "verify", error: { code?: string; status?: number; message: string }) {
  console.error(`[sign-in] ${step} failed`, { code: error.code, status: error.status, message: error.message });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
