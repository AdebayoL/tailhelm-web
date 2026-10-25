import { describe, expect, it } from "vitest";
import { NOTICED_ACTION, NOTICED_FREE_LINE, noticedSource, noticedVisible, onToday, recordLines, whyLines } from "./view";

const BANNED = /\b(safe|normal|fine|good|bad|better|worse|healthy|streak|compliance|administer|dosage|dose|should|must)\b/i;

const row = {
  computed_on: "2026-10-25",
  dismissed_at: null,
  window_start: "2026-10-01",
  evidence_json: {
    rule: "Tailhelm looks for a value it works out from a lab report, such as the Na:K ratio, that moves the same way across 3 or more results in a row.",
    from: "2026-09-26",
    records: [
      { id: "l1", on: "2026-10-01", text: "Lab report: Na:K ratio 30.1" },
      { id: "l1", on: "2025-12-01", text: "Lab report: Na:K ratio 31.0" },
    ],
  },
};

describe("Noticed on screen", () => {
  it("names one action, the vet, and says where it came from", () => {
    expect(NOTICED_ACTION).toBe("Worth mentioning to your vet.");
    expect(noticedSource("Bella")).toBe("From Bella’s own records.");
    expect(`${NOTICED_ACTION} ${NOTICED_FREE_LINE} ${noticedSource("Bella")}`).not.toMatch(BANNED);
  });

  it("explains the rule, what it reads and what it doesn't", () => {
    const lines = whyLines(row, "Bella", "2026-10-25");
    expect(lines).toEqual([
      row.evidence_json.rule,
      "It looks only at Bella’s own records, never at other dogs, and it doesn’t predict anything. It read Bella’s records from 26 Sep to 25 Oct.",
      "Tailhelm shows at most one observation a week. Alerts are separate and always show.",
    ]);
    expect(whyLines({ ...row, evidence_json: { ...row.evidence_json, from: null } }, "Bella", "2026-10-25")[1]).toContain(
      "It read all of Bella’s records up to 25 Oct.",
    );
    expect(lines.join(" ")).not.toMatch(BANNED);
  });

  it("lists each record with its date, and the year when it isn't this one", () => {
    expect(recordLines(row, "2026-10-25").map((r) => [r.date, r.text])).toEqual([
      ["1 Oct", "Lab report: Na:K ratio 30.1"],
      ["1 Dec 2025", "Lab report: Na:K ratio 31.0"],
    ]);
    expect(new Set(recordLines(row, "2026-10-25").map((r) => r.key)).size).toBe(2);
  });

  it("shows a free account only what its 30 days hold", () => {
    expect(noticedVisible(row, "2026-09-26")).toBe(true);
    expect(noticedVisible(row, "2026-10-02")).toBe(false);
    expect(noticedVisible(row, null)).toBe(true);
  });

  it("keeps one on Today for a week, until it is dismissed", () => {
    expect(onToday(row, "2026-10-31")).toBe(true);
    expect(onToday(row, "2026-11-01")).toBe(false);
    expect(onToday({ ...row, dismissed_at: "2026-10-26T08:00:00Z" }, "2026-10-26")).toBe(false);
  });
});
