import { z } from "zod";
import { type PlanSchedule, parsePlanSchedule } from "@/engine/schedule";
import { isLocalDate, isLocalTime } from "@/engine/time";
import { getPack, medicinesFor } from "@/packs/registry";

/**
 * The prescribed layer as the owner types it from their vet's instructions.
 * Nothing here suggests or works out an amount: the owner enters the amount,
 * the unit and the date the vet set them, and the app keeps them as typed.
 */

export const DOSE_UNITS = ["mg", "mL", "micrograms", "tablets"] as const;

export type FieldErrors = Record<string, string>;

const text = (max: number) => z.string().trim().max(max);

export type ConditionInput = { condition_key: string; variant: string; diagnosed_on: string | null };

export function parseConditionForm(form: FormData): { ok: true; value: ConditionInput } | { ok: false; errors: FieldErrors } {
  const conditionKey = String(form.get("condition_key") ?? "");
  const pack = getPack(conditionKey);
  if (!pack) return { ok: false, errors: { condition_key: "Choose a condition." } };

  const variant = String(form.get("variant") ?? "");
  const errors: FieldErrors = {};
  if (!pack.variants.includes(variant)) errors.variant = "Choose the type your vet diagnosed.";

  const diagnosed = String(form.get("diagnosed_on") ?? "").trim();
  if (diagnosed && (!isLocalDate(diagnosed) || diagnosed > today())) {
    errors.diagnosed_on = "Enter the date of diagnosis, or leave it blank.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { condition_key: conditionKey, variant, diagnosed_on: diagnosed || null } };
}

export type PlanItemInput = {
  pack_key: string;
  kind: "medicine" | "observation";
  product: string;
  strength: string | null;
  dose_amount: number | null;
  dose_unit: (typeof DOSE_UNITS)[number] | null;
  schedule_kind: PlanSchedule["kind"];
  schedule_json: PlanSchedule;
  usual_times: string[];
  set_by_vet_on: string;
  vet_instructions: string | null;
};

export type PlanOption = {
  key: string;
  kind: "medicine" | "observation";
  name: string;
  scheduleKind: PlanSchedule["kind"];
  /** The pack's own description, shown as a hint. */
  hint: string | null;
};

/**
 * What the owner can add to the plan: the medicines the pack lists for the
 * dog's variant, and the tests it times from an injection. The pack names
 * each one; the owner enters every number from their vet.
 */
export function planOptions(conditionKey: string, variant: string | null): PlanOption[] {
  const pack = getPack(conditionKey);
  if (!pack) return [];
  const medicines: PlanOption[] = medicinesFor(pack, variant).map((m) => ({
    key: m.key,
    kind: "medicine",
    name: m.name,
    scheduleKind: m.scheduleKind,
    hint: null,
  }));
  const tests: PlanOption[] = pack.monitoringRules
    .filter((r) => r.scheduleKind === "offset")
    .map((r) => ({
      key: r.key,
      kind: "observation",
      name: pack.observationTypes.find((o) => o.key === r.observationType)?.name ?? r.description,
      scheduleKind: "offset",
      hint: r.description,
    }));
  return [...medicines, ...tests];
}

/** Reads one plan item from the form, checked against what the pack lists for the dog's variant. */
export function parsePlanItemForm(
  form: FormData,
  conditionKey: string,
  variant: string | null,
): { ok: true; value: PlanItemInput } | { ok: false; errors: FieldErrors } {
  const option = planOptions(conditionKey, variant).find((o) => o.key === form.get("pack_key"));
  if (!option) return { ok: false, errors: { pack_key: "Choose what to add." } };
  if (option.kind === "observation") return parseTestItem(form, option);
  const medicine = option;

  const errors: FieldErrors = {};
  const product = text(80).safeParse(form.get("product") ?? "");
  if (!product.success || product.data === "") errors.product = "Enter the medicine's name as it is on the label.";
  const strength = text(40).safeParse(form.get("strength") ?? "");

  const amountRaw = String(form.get("dose_amount") ?? "").trim();
  const amount = Number(amountRaw);
  if (!/^\d+(\.\d{1,3})?$/.test(amountRaw) || !(amount > 0)) {
    errors.dose_amount = "Enter the amount your vet gave you, as a number.";
  }
  const unit = DOSE_UNITS.find((u) => u === form.get("dose_unit"));
  if (!unit) errors.dose_unit = "Choose the unit your vet used.";

  const setOn = String(form.get("set_by_vet_on") ?? "").trim();
  if (!isLocalDate(setOn) || setOn > today()) errors.set_by_vet_on = "Enter the date your vet set this.";

  const instructions = text(500).safeParse(form.get("vet_instructions") ?? "");
  if (!instructions.success) errors.vet_instructions = "Use 500 characters or fewer.";

  const schedule = readSchedule(form, medicine.scheduleKind, errors);

  if (Object.keys(errors).length > 0 || !schedule || !unit) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pack_key: medicine.key,
      kind: "medicine",
      product: product.success ? product.data : "",
      strength: strength.success && strength.data !== "" ? strength.data : null,
      dose_amount: amount,
      dose_unit: unit,
      schedule_kind: schedule.kind,
      schedule_json: schedule,
      usual_times: schedule.kind === "fixed" ? schedule.times : schedule.kind === "interval" ? [schedule.time] : [],
      set_by_vet_on: setOn,
      vet_instructions: instructions.success && instructions.data !== "" ? instructions.data : null,
    },
  };
}

/** A test the vet asked for on set days after each injection. No amount: only the days and a reminder time. */
function parseTestItem(form: FormData, option: PlanOption): { ok: true; value: PlanItemInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const setOn = String(form.get("set_by_vet_on") ?? "").trim();
  if (!isLocalDate(setOn) || setOn > today()) errors.set_by_vet_on = "Enter the date your vet asked for these tests.";
  const instructions = text(500).safeParse(form.get("vet_instructions") ?? "");
  if (!instructions.success) errors.vet_instructions = "Use 500 characters or fewer.";
  const schedule = readSchedule(form, option.scheduleKind, errors);
  if (Object.keys(errors).length > 0 || !schedule) return { ok: false, errors };
  return {
    ok: true,
    value: {
      pack_key: option.key,
      kind: "observation",
      product: option.name,
      strength: null,
      dose_amount: null,
      dose_unit: null,
      schedule_kind: schedule.kind,
      schedule_json: schedule,
      usual_times: schedule.kind === "offset" ? [schedule.time] : [],
      set_by_vet_on: setOn,
      vet_instructions: instructions.success && instructions.data !== "" ? instructions.data : null,
    },
  };
}

function readSchedule(form: FormData, kind: PlanSchedule["kind"], errors: FieldErrors): PlanSchedule | null {
  if (kind === "fixed") {
    const times = form
      .getAll("times")
      .map((t) => String(t).trim())
      .filter((t) => t !== "");
    if (times.length === 0 || !times.every(isLocalTime)) {
      errors.times = "Enter each time your vet set, such as 08:00.";
      return null;
    }
    const parsed = parsePlanSchedule({ kind, times: [...new Set(times)].sort() }, kind);
    return parsed.ok ? parsed.schedule : null;
  }
  if (kind === "interval") {
    const everyDays = Number(String(form.get("every_days") ?? "").trim());
    const time = String(form.get("time") ?? "").trim();
    if (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 366) {
      errors.every_days = "Enter the number of days your vet set between injections.";
    }
    if (!isLocalTime(time)) errors.time = "Enter a time for the reminder, such as 09:00.";
    if (errors.every_days || errors.time) return null;
    const parsed = parsePlanSchedule({ kind, everyDays, time }, kind);
    return parsed.ok ? parsed.schedule : null;
  }
  if (kind === "offset") {
    const raw = String(form.get("offsets_days") ?? "").trim();
    const parts = raw.replace(/\band\b/gi, " ").split(/[\s,]+/).filter((p) => p !== "");
    const days = parts.map(Number);
    const time = String(form.get("time") ?? "").trim();
    if (days.length === 0 || !parts.every((p) => /^\d{1,3}$/.test(p)) || days.some((d) => d < 1 || d > 366)) {
      errors.offsets_days = "Enter the days after the injection your vet gave you, such as 10, 25.";
    }
    if (!isLocalTime(time)) errors.time = "Enter a time for the reminder, such as 09:00.";
    if (errors.offsets_days || errors.time) return null;
    const parsed = parsePlanSchedule({ kind, offsetsDays: [...new Set(days)].sort((a, b) => a - b), time }, kind);
    return parsed.ok ? parsed.schedule : null;
  }
  errors.pack_key = "This can't be added here yet.";
  return null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function joinTimes(times: string[]): string {
  return times.length === 1 ? times[0] : `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}`;
}

function describeSchedule(schedule: PlanSchedule): string {
  switch (schedule.kind) {
    case "fixed": {
      const n = schedule.times.length;
      const often = n === 1 ? "once a day" : n === 2 ? "twice a day" : `${n} times a day`;
      return `${often} at ${joinTimes(schedule.times)}`;
    }
    case "interval":
      return `every ${schedule.everyDays} days, reminder at ${schedule.time}`;
    case "offset":
      return `on days ${joinTimes(schedule.offsetsDays.map(String))} after an injection`;
    case "series":
      return `${schedule.readings} readings, ${schedule.everyMinutes} minutes apart`;
    case "event":
      return "when it happens";
  }
}

const formatAmount = (n: number) => String(Number(n.toFixed(3)));

/** The plan item exactly as entered, e.g. "Prednisolone 5 mg tablets, 2.5 mg once a day at 08:00 (set by vet 12 Sep 2026)". */
export function describePlanItem(item: {
  product: string | null;
  strength: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  schedule_json: PlanSchedule;
  set_by_vet_on: string | null;
}): string {
  const name = [item.product, item.strength].filter(Boolean).join(" ");
  const dose = item.dose_amount !== null && item.dose_unit ? `${formatAmount(item.dose_amount)} ${item.dose_unit}` : null;
  const what = dose ? `${name}, ${dose}` : name;
  const set = item.set_by_vet_on ? ` (set by vet ${formatDate(item.set_by_vet_on)})` : "";
  return `${what} ${describeSchedule(item.schedule_json)}${set}`;
}
