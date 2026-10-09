import { describe, expect, it } from "vitest";
import { projectOrigin } from "./env";

describe("projectOrigin", () => {
  it.each([
    "https://abc.supabase.co",
    "https://abc.supabase.co/",
    "https://abc.supabase.co/rest/v1/",
    " https://abc.supabase.co/rest/v1 ",
  ])("reduces %s to the project address", (raw) => {
    expect(projectOrigin(raw)).toBe("https://abc.supabase.co");
  });
});
