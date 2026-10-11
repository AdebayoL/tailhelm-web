import type { ReactNode } from "react";
import { Icon } from "./icon";

/** The ids a control is described by: its hint and its error, when shown. */
export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

/** What went wrong, in words, above the control it is about. */
export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="err" id={id}>
      <Icon name="attention" />
      <span>{children}</span>
    </p>
  );
}

/** A label, an optional hint and error, then the control: the design's field. */
export function Field({
  id,
  label,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>
        {label}
        {optional && (
          <span className="c2" style={{ fontWeight: 400 }}>
            {" "}
            (optional)
          </span>
        )}
      </label>
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
      {children}
    </div>
  );
}

/** A choice of one, in the checkbox geometry. */
export function RadioGroup({
  name,
  legend,
  options,
  value,
  defaultValue,
  onChange,
  error,
}: {
  name: string;
  legend: ReactNode;
  options: { value: string; label: ReactNode }[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="field" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="lbl">{legend}</legend>
      {error && <ErrorText id={`${name}-error`}>{error}</ErrorText>}
      <div>
        {options.map((o) => (
          <label key={o.value} className="radio">
            <input
              type="radio"
              name={name}
              value={o.value}
              {...(value === undefined
                ? { defaultChecked: defaultValue === o.value }
                : { checked: value === o.value, onChange: () => onChange?.(o.value) })}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "This wasn't saved": shown when the request reached Tailhelm and failed. */
export function NotSaved({ what = "This" }: { what?: string }) {
  return (
    <div className="banner banner-warn" role="alert">
      <Icon name="alert" />
      <p>
        <b>{what} wasn&rsquo;t saved.</b> Try again in a minute.
      </p>
    </div>
  );
}
