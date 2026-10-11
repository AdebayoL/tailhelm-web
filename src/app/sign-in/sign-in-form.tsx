"use client";

import { type ReactNode, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/app/_components/icon";
import { CODE_LENGTH, CODE_VALID_MINUTES, RESEND_AFTER_SECONDS } from "@/lib/auth/input";
import { signInStep, type SignInState } from "./actions";

/** Email, then a 6-digit code. The brand side stays put while the form side changes step. */
export function SignInForm({ next, side }: { next: string; side: ReactNode }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStep, {
    step: "email",
    email: "",
    next,
  });

  return (
    <div className={state.step === "code" ? "auth is-code" : "auth"}>
      {side}
      <main className="auth-main">
        {state.step === "email" ? (
          <form action={action} noValidate className="stack-24 auth-form">
            <input type="hidden" name="next" value={state.next} />
            <div className="stack-8">
              <h1 className="auth-title">Sign in</h1>
              <p className="ty-lead c2">Enter your email address and we&rsquo;ll send you a 6-digit code. There&rsquo;s no password to remember.</p>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="email">
                Email address
              </label>
              {state.error && (
                <p className="err" id="email-error" role="alert">
                  <Icon name="attention" />
                  {state.error}
                </p>
              )}
              <input
                className="inp"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                defaultValue={state.email}
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? "email-error" : undefined}
              />
            </div>
            <button type="submit" disabled={pending} className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}>
              {pending && <span className="spin" aria-hidden="true" />}
              {pending ? "Sending code…" : "Send code"}
            </button>
            <p className="prov">New to Tailhelm? These same steps create your account.</p>
          </form>
        ) : (
          <form action={action} noValidate className="stack-24 auth-form">
            <input type="hidden" name="next" value={state.next} />
            <CodeStep state={state} />
          </form>
        )}
      </main>
    </div>
  );
}

function CodeStep({ state }: { state: SignInState }) {
  const { pending, data } = useFormStatus();
  const intent = pending ? data?.get("intent") : null;
  const checking = pending && !intent;
  return (
    <>
      <button type="submit" name="intent" value="change-email" formNoValidate className="back auth-back" disabled={pending}>
        <Icon name="back" />
        Change email
      </button>
      <div className="stack-8">
        <h1 className="auth-title">Check your email</h1>
        <p className="ty-lead c2 tn" aria-live="polite">
          We sent a 6-digit code to <span className="auth-email">{state.email}</span>. It works for {CODE_VALID_MINUTES} minutes
          {state.sentAt ? <>, until {until(state.sentAt)}</> : null}.
        </p>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="code">
          6-digit code
        </label>
        {state.error && (
          <p className="err" id="code-error" role="alert">
            <Icon name="attention" />
            {state.error}
          </p>
        )}
        <CodeBoxes disabled={pending} error={state.error} />
      </div>
      <button type="submit" disabled={pending} className={checking ? "btn btn-primary is-loading" : "btn btn-primary"}>
        {checking && <span className="spin" aria-hidden="true" />}
        {checking ? "Checking code…" : "Sign in"}
      </button>
      {checking ? (
        <p className="prov" style={{ textAlign: "center" }}>
          Signing in as {state.email}
        </p>
      ) : (
        <div className="stack-4">
          <Resend sentAt={state.sentAt} sending={intent === "resend"} disabled={pending} />
          <p className="prov">Not arrived? Check your junk or spam folder.</p>
        </div>
      )}
    </>
  );
}

/**
 * Six boxes over one real input, so typing, pasting and the phone's code
 * autofill all work. The form sends itself once the sixth digit is in.
 */
function CodeBoxes({ disabled, error }: { disabled: boolean; error?: string }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // After a refused code, put the cursor back so the owner can type again.
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);
  const current = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className="code-wrap">
      <div className="code" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span key={i} className={`d${disabled ? " is-disabled" : focused && i === current ? " is-focus" : ""}`}>
            {value[i] ?? (focused && !disabled && i === current ? <span className="caret" /> : null)}
          </span>
        ))}
      </div>
      <input
        ref={input}
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={value}
        readOnly={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "code-error" : undefined}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const digits = e.currentTarget.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          const complete = digits.length === CODE_LENGTH && value.length < CODE_LENGTH;
          setValue(digits);
          if (complete) {
            e.currentTarget.value = digits;
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
    </div>
  );
}

function Resend({ sentAt, sending, disabled }: { sentAt?: number; sending: boolean; disabled: boolean }) {
  const now = useNow();
  const wait = sentAt ? Math.max(0, Math.min(RESEND_AFTER_SECONDS, RESEND_AFTER_SECONDS - Math.floor((now - sentAt) / 1000))) : 0;
  const waiting = wait > 0;
  return (
    <button
      type="submit"
      name="intent"
      value="resend"
      formNoValidate
      className="lnk"
      style={{ alignSelf: "flex-start" }}
      disabled={disabled || waiting}
    >
      {sending ? "Sending a new code…" : waiting ? `Send a new code in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}` : "Send a new code"}
    </button>
  );
}

/** The time now, ticking each second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The clock time the code stops working, on this device. */
function until(sentAt: number) {
  return new Date(sentAt + CODE_VALID_MINUTES * 60_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
