export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
) {
  const pageSize = 1000;
  const rows: T[] = [];
  let total: number | null = null;
  for (let from = 0; ;) {
    const { data, error, count } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load dashboard data: ${error.message}`);
    const page = data ?? [];
    if (from === 0) total = count ?? null;
    rows.push(...page);
    from += page.length;
    if (total !== null && from >= total) return rows;
    if (page.length === 0) {
      if (total !== null) throw new Error("Dashboard data changed during pagination; please refresh.");
      return rows;
    }
  }
}
