"use client";

import { useState } from "react";
import { ErrorText } from "./form";

const pad = (s: string, n: number) => s.trim().padStart(n, "0");

/** The three boxes as one value for the form: "2026-09-12", or something the parser will refuse. */
export function joinDateParts(day: string, month: string, year: string): string {
  if (!day.trim() && !month.trim() && !year.trim()) return "";
  if (!day.trim() || !month.trim() || year.trim().length !== 4) return "incomplete";
  return `${year.trim()}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * A date as three boxes, Day, Month and Year, the way people read it off a
 * label or a letter. The form gets one value under `name`, so the server
 * reads and checks it as it does any other date.
 */
export function DateParts({
  name,
  legend,
  optional = false,
  hint = "For example, 12 9 2026",
  error,
  defaultValue = "",
}: {
  name: string;
  legend: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
}) {
  const [y0 = "", m0 = "", d0 = ""] = /^\d{4}-\d{2}-\d{2}$/.test(defaultValue) ? defaultValue.split("-") : [];
  const [day, setDay] = useState(d0 ? String(Number(d0)) : "");
  const [month, setMonth] = useState(m0 ? String(Number(m0)) : "");
  const [year, setYear] = useState(y0);
  const describe = [`${name}-hint`, error ? `${name}-error` : null].filter(Boolean).join(" ");
  const box = (label: string, value: string, set: (v: string) => void, width: number, max: number) => (
    <div className="part">
      <span aria-hidden="true">{label}</span>
      <input
        className="inp"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={max}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        style={{ width }}
      />
    </div>
  );
  return (
    <fieldset className="field">
      <legend className="lbl">
        {legend}
        {optional && (
          <span className="c2" style={{ fontWeight: 400 }}>
            {" "}
            (optional)
          </span>
        )}
      </legend>
      <p className="hint" id={`${name}-hint`}>
        {hint}
      </p>
      {error && <ErrorText id={`${name}-error`}>{error}</ErrorText>}
      <div className="date">
        {box("Day", day, setDay, 64, 2)}
        {box("Month", month, setMonth, 64, 2)}
        {box("Year", year, setYear, 96, 4)}
      </div>
      <input type="hidden" name={name} value={joinDateParts(day, month, year)} />
    </fieldset>
  );
}
