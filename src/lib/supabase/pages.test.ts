import { describe, expect, it } from "vitest";
import { PAGE, allPages } from "./pages";

/** A stand-in query over `total` rows that records each range asked for. */
function rows(total: number, error: string | null = null) {
  const asked: [number, number][] = [];
  const build = () => ({
    range: async (from: number, to: number) => {
      asked.push([from, to]);
      if (error) return { data: null, error: { message: error } };
      const end = Math.min(to + 1, total);
      return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null };
    },
  });
  return { asked, build };
}

describe("allPages", () => {
  it("reads one page when there are fewer rows than a page", async () => {
    const q = rows(3);
    expect(await allPages<number>(q.build, "Could not load")).toEqual([0, 1, 2]);
    expect(q.asked).toEqual([[0, PAGE - 1]]);
  });

  it("keeps reading past 1,000 rows until a page comes back short", async () => {
    const q = rows(2 * PAGE + 5);
    const all = await allPages<number>(q.build, "Could not load");
    expect(all).toHaveLength(2 * PAGE + 5);
    expect(all[PAGE]).toBe(PAGE);
    expect(all.at(-1)).toBe(2 * PAGE + 4);
    expect(q.asked).toEqual([
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
      [2 * PAGE, 3 * PAGE - 1],
    ]);
  });

  it("stops on an empty page when the rows fill pages exactly", async () => {
    const q = rows(PAGE);
    expect(await allPages<number>(q.build, "Could not load")).toHaveLength(PAGE);
    expect(q.asked).toHaveLength(2);
  });

  it("says what failed", async () => {
    await expect(allPages(rows(0, "timeout").build, "Could not export doses given")).rejects.toThrow("Could not export doses given: timeout");
  });
});
