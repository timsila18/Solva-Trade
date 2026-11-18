export async function loadDocumentRows<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
) {
  const rows: T[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await load(rows.length, rows.length + 999);
    if (error) throw new Error(`Could not load document items. ${error.message}`);
    if (typeof count === "number") total = count;
    if (!data?.length) {
      if (total !== null && rows.length < total) throw new Error("Document items changed during generation. Please try again.");
      return { data: rows, error: null };
    }
    rows.push(...data);
    if (total !== null && rows.length >= total) return { data: rows, error: null };
  }
}
