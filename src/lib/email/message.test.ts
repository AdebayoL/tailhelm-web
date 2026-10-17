import { describe, expect, it } from "vitest";
import type { Notice } from "@/lib/reminders/due";
import { EMAIL_FOOTER, reminderEmail } from "./message";

const BANNED = /\b(safe|normal|fine|streak|compliance|administer|dosage|good|bad)\b/i;
const DOSE = /\d\s*(mg|ml|mcg|µg|tablet)/i;

const notice: Notice = {
  kind: "dose_not_ticked",
  ref: "pred:2026-10-13:08:00",
  tag: "dose:pred:2026-10-13:08:00",
  title: "Bella’s Prednisolone isn’t ticked yet today",
  body: "It was due at 08:00.",
  url: "/today",
  at: new Date("2026-10-13T09:00:00Z"),
};

describe("reminderEmail", () => {
  it("uses the notice's own words, links back to the app and to the email setting", () => {
    const m = reminderEmail(notice, "https://tailhelm.com");
    expect(m.subject).toBe("Bella’s Prednisolone isn’t ticked yet today");
    expect(m.text).toContain("It was due at 08:00.");
    expect(m.text).toContain("Open Tailhelm: https://tailhelm.com/today");
    expect(m.text).toContain("https://tailhelm.com/reminders");
    expect(m.html).toContain('href="https://tailhelm.com/today"');
  });

  it("carries the backup reminder the spec puts in every reminder email", () => {
    const m = reminderEmail(notice, "https://tailhelm.com");
    expect(m.text).toContain(EMAIL_FOOTER);
    expect(m.html).toContain("call your vet if a dose is missed");
  });

  it("says why a reminder health email came, without the reminder email setting", () => {
    const m = reminderEmail(
      { ...notice, kind: "phone_lost", title: "Bella’s reminders can no longer reach your iPhone", url: "/reminders" },
      "https://tailhelm.com",
    );
    expect(m.text).toContain("Tailhelm emails you when a reminder stops reaching you, even with reminder emails off.");
    expect(m.text).not.toContain("You can turn them off");
    expect(m.text).toContain(EMAIL_FOOTER);
    expect(m.html).toContain('href="https://tailhelm.com/reminders"');
  });

  it("escapes names typed by the owner", () => {
    const m = reminderEmail({ ...notice, title: "Rex <b>’s Pred & co" }, "https://tailhelm.com");
    expect(m.html).toContain("Rex &lt;b&gt;’s Pred &amp; co");
    expect(m.html).not.toContain("<b>");
  });

  it("never carries a dose or a banned word", () => {
    const m = reminderEmail(notice, "https://tailhelm.com");
    expect(m.text).not.toMatch(BANNED);
    expect(m.text).not.toMatch(DOSE);
  });
});
