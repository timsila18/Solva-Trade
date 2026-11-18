import type { SupabaseClient } from "@supabase/supabase-js";

// Keyset batches avoid increasingly expensive offsets and never impose a total-row cap.
export async function loadSalesDashboardRows<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  columns: string,
  businessId: string,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    let query = client.from(table).select(columns).eq("business_id", businessId).order("id").limit(1000);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load sales dashboard ${table}: ${error.message}`);
    const batch = (data ?? []) as unknown as T[];
    if (!batch.length) return rows;
    const next = batch[batch.length - 1].id;
    if (after && next <= after) throw new Error(`Sales dashboard ${table} cursor did not advance`);
    rows.push(...batch);
    after = next;
    // Probe until empty: a server-side row limit may be smaller than our batch size.
  }
}
