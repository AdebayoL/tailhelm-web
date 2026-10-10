import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/plan/input";
import { getPack } from "@/packs/registry";
import { discardDate, vialRule, vialWarning, vialWarningText } from "./vial";

const rule = vialRule(getPack("addisons"))!;

describe("opened vial warning", () => {
  it("reads its months from the Addison's pack", () => {
    expect(rule.months).toBe(4);
  });

  it("works out the use-by date in calendar months", () => {
    expect(discardDate("2026-10-31", rule)).toBe("2027-02-28");
  });

  it("stays quiet before the use-by date, since no source gives an earlier warning", () => {
    expect(vialWarning("2026-10-01", rule, "2027-01-31")).toBeNull();
  });

  it("warns on the use-by date", () => {
    expect(vialWarning("2026-10-01", rule, "2027-02-01")).toEqual({ openedOn: "2026-10-01", useBy: "2027-02-01", daysLeft: 0 });
  });

  it("keeps warning after the use-by date", () => {
    expect(vialWarning("2026-10-01", rule, "2027-02-10")?.daysLeft).toBe(-9);
  });

  it("needs an opened date", () => {
    expect(vialWarning(null, rule, "2027-02-10")).toBeNull();
  });

  it("fills in the pack's wording", () => {
    const w = vialWarning("2026-10-01", rule, "2027-02-01")!;
    expect(vialWarningText(w, rule, formatDate)).toBe(
      "This vial was opened on 1 Oct 2026. The label says use within 4 months of opening, which is 1 Feb 2027. Contact your vet about a new vial.",
    );
  });
});
