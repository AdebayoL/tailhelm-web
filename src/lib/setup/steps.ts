import { ACKNOWLEDGEMENT } from "@/lib/app/acknowledgement";

/**
 * The setup every person goes through once they have a dog with a care plan
 * (Build Spec, "Reminders"). It cannot be skipped: each step is faced in turn,
 * and setup is done only when the acknowledgement is recorded. A layer the
 * person cannot or will not turn on is passed only after saying plainly what
 * that costs.
 *
 * On an iPhone or iPad the first step is adding Tailhelm to the Home Screen,
 * because nothing else works until it is there. Elsewhere that step is left out.
 */
export const SETUP_STEPS = ["home", "notifications", "calendar", "test", "acknowledge"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** The step named in the address, or the first one. */
export function parseStep(raw: unknown): SetupStep {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (SETUP_STEPS as readonly unknown[]).includes(value) ? (value as SetupStep) : "home";
}

/** The steps this device goes through. */
export function stepsFor(needsHomeScreen: boolean): SetupStep[] {
  return needsHomeScreen ? [...SETUP_STEPS] : SETUP_STEPS.filter((s) => s !== "home");
}

export function nextStep(step: SetupStep): SetupStep | null {
  const i = SETUP_STEPS.indexOf(step);
  return SETUP_STEPS[i + 1] ?? null;
}

export function previousStep(step: SetupStep, needsHomeScreen: boolean): SetupStep | null {
  const steps = stepsFor(needsHomeScreen);
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1] : null;
}

/** "Step 2 of 4", counting only the steps this device goes through. */
export function stepLabel(step: SetupStep, needsHomeScreen: boolean): string {
  const steps = stepsFor(needsHomeScreen);
  const i = steps.indexOf(step);
  return `Step ${Math.max(i, 0) + 1} of ${steps.length}`;
}

export const stepHref = (step: SetupStep) => `/setup?step=${step}`;

/** Whether this person still has to go through setup. */
export function setupNeeded(args: { hasPlan: boolean; acknowledged: { kind: string; version: string }[] }): boolean {
  if (!args.hasPlan) return false;
  return !args.acknowledged.some((c) => c.kind === ACKNOWLEDGEMENT.kind && c.version === ACKNOWLEDGEMENT.version);
}
