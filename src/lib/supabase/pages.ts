/** The most rows the database sends for one request. */
export const PAGE = 1000;

type Page = { data: unknown; error: { message: string } | null };

/**
 * Every row a query returns, a page at a time, as the database sends at most
 * 1,000 rows at once. `build` makes the query afresh for each page and must
 * give it a stable order, ending on a unique column, so no row is skipped or
 * read twice between pages.
 */
export async function allPages<T>(build: () => { range: (from: number, to: number) => PromiseLike<Page> }, failure: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(`${failure}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}
