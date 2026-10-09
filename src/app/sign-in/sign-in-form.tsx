"use client";

import { useActionState } from "react";
import { signInStep, type SignInState } from "./actions";

const field =
  "w-full rounded-lg border border-ink/30 bg-paper px-4 py-3 text-lg focus:border-green focus:outline-2 focus:outline-green";
const primary =
  "w-full rounded-lg bg-green px-4 py-3 text-lg font-semibold text-paper disabled:opacity-60";
const secondary = "text-green underline underline-offset-4 disabled:opacity-60";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStep, {
    step: "email",
    email: "",
    next,
  });

  if (state.step === "email") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={state.next} />
        <label htmlFor="email" className="text-lg font-semibold">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-describedby={state.error ? "sign-in-error" : undefined}
          className={field}
        />
        {state.error && (
          <p id="sign-in-error" role="alert" className="font-semibold">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Sending…" : "Send my code"}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={state.next} />
      <p aria-live="polite">
        We sent a 6-digit code to <strong>{state.email}</strong>. It can take a minute to arrive.
      </p>
      <label htmlFor="code" className="text-lg font-semibold">
        Code
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 \-]*"
        maxLength={9}
        required
        autoFocus
        aria-describedby={state.error ? "sign-in-error" : undefined}
        className={`${field} tracking-[0.3em]`}
      />
      {state.error && (
        <p id="sign-in-error" role="alert" className="font-semibold">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Checking…" : "Sign in"}
      </button>
      <div className="flex justify-between gap-4">
        <button type="submit" name="intent" value="resend" formNoValidate disabled={pending} className={secondary}>
          Send a new code
        </button>
        <button type="submit" name="intent" value="change-email" formNoValidate disabled={pending} className={secondary}>
          Use a different email
        </button>
      </div>
    </form>
  );
}
