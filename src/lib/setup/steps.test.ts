import { describe, expect, it } from "vitest";
import { ACKNOWLEDGEMENT } from "@/lib/app/acknowledgement";
import { nextStep, parseStep, previousStep, setupNeeded, stepLabel, stepsFor } from "./steps";

describe("setup steps", () => {
  it("starts with the Home Screen on an iPhone, and leaves it out elsewhere", () => {
    expect(stepsFor(true)).toEqual(["home", "notifications", "calendar", "test", "acknowledge"]);
    expect(stepsFor(false)).toEqual(["notifications", "calendar", "test", "acknowledge"]);
  });

  it("goes notifications, calendar, test, then the acknowledgement, as the spec orders them", () => {
    expect(nextStep("home")).toBe("notifications");
    expect(nextStep("notifications")).toBe("calendar");
    expect(nextStep("calendar")).toBe("test");
    expect(nextStep("test")).toBe("acknowledge");
    expect(nextStep("acknowledge")).toBeNull();
  });

  it("goes back only to a step this device has", () => {
    expect(previousStep("notifications", true)).toBe("home");
    expect(previousStep("notifications", false)).toBeNull();
    expect(previousStep("acknowledge", false)).toBe("test");
  });

  it("counts only the steps this device goes through", () => {
    expect(stepLabel("home", true)).toBe("Step 1 of 5");
    expect(stepLabel("notifications", false)).toBe("Step 1 of 4");
    expect(stepLabel("acknowledge", false)).toBe("Step 4 of 4");
  });

  it("reads the step from the address, and starts at the beginning for anything else", () => {
    expect(parseStep("calendar")).toBe("calendar");
    expect(parseStep(["test", "calendar"])).toBe("test");
    expect(parseStep("done")).toBe("home");
    expect(parseStep(undefined)).toBe("home");
  });
});

describe("setupNeeded", () => {
  const current = { kind: ACKNOWLEDGEMENT.kind, version: ACKNOWLEDGEMENT.version };

  it("waits until there is a care plan to remind about", () => {
    expect(setupNeeded({ hasPlan: false, acknowledged: [] })).toBe(false);
  });

  it("is needed until this version of the acknowledgement is recorded", () => {
    expect(setupNeeded({ hasPlan: true, acknowledged: [] })).toBe(true);
    expect(setupNeeded({ hasPlan: true, acknowledged: [{ kind: "acknowledgement", version: "2000-01-01" }] })).toBe(true);
    expect(setupNeeded({ hasPlan: true, acknowledged: [current] })).toBe(false);
  });
});
