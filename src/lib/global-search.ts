import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type GlobalSearchResult = { id: string; label: string; hint: string; href: string; group: string };
type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function searchWorkspace(client: Client, businessId: string, query: string) {
  const needle = query.normalize("NFKC").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!needle) return { results: [] as GlobalSearchResult[], partial: false };
  const prefix = `${needle}%`;
  const results: GlobalSearchResult[] = [];
  const lookups = await Promise.all([
    client.from("customers").select("id, customer_name, customer_code, phone").eq("business_id", businessId).eq("active", true)
      .or(`customer_name.ilike.${prefix},customer_code.ilike.${prefix},phone.ilike.${prefix}`).order("customer_name").limit(5),
    client.from("suppliers").select("id, legal_name, trading_name, supplier_code").eq("business_id", businessId).eq("active", true)
      .or(`legal_name.ilike.${prefix},trading_name.ilike.${prefix},supplier_code.ilike.${prefix}`).order("legal_name").limit(5),
    client.from("products").select("id, product_name, sku, product_code").eq("business_id", businessId).eq("active", true).eq("archived", false)
      .or(`product_name.ilike.%${needle}%,sku.ilike.%${needle}%,product_code.ilike.%${needle}%`).order("product_name").limit(5),
    client.from("sales_invoices").select("id, invoice_number, total_amount, customers(customer_name)").eq("business_id", businessId)
      .not("status", "in", "(reversed,cancelled)").ilike("invoice_number", prefix).order("created_at", { ascending: false }).limit(5),
    client.from("goods_received_notes").select("id, grn_number, receipt_date").eq("business_id", businessId)
      .ilike("grn_number", prefix).order("created_at", { ascending: false }).limit(5),
    client.from("customer_payments").select("id, payment_number, amount_received, customers(customer_name)").eq("business_id", businessId).neq("status", "reversed")
      .ilike("payment_number", prefix).order("created_at", { ascending: false }).limit(5),
  ]);
  for (const row of lookups[0].data ?? []) results.push({ id: `customer:${row.id}`, label: row.customer_name, hint: [row.customer_code, row.phone].filter(Boolean).join(" - "), href: `/sales?historyCustomer=${encodeURIComponent(row.customer_name)}`, group: "Customers" });
  for (const row of lookups[1].data ?? []) results.push({ id: `supplier:${row.id}`, label: row.trading_name || row.legal_name, hint: row.supplier_code || "", href: `/suppliers?q=${encodeURIComponent(row.trading_name || row.legal_name)}`, group: "Suppliers" });
  for (const row of lookups[2].data ?? []) results.push({ id: `product:${row.id}`, label: row.product_name, hint: row.sku || row.product_code || "", href: `/inventory/products?q=${encodeURIComponent(row.sku || row.product_name)}`, group: "Products" });
  for (const row of lookups[3].data ?? []) results.push({ id: `invoice:${row.id}`, label: row.invoice_number, hint: `KES ${Number(row.total_amount || 0).toLocaleString("en-KE")}`, href: `/api/exports?module=Sales&process=Invoice&format=pdf&invoiceId=${row.id}`, group: "Invoices" });
  for (const row of lookups[4].data ?? []) results.push({ id: `grn:${row.id}`, label: row.grn_number, hint: row.receipt_date || "", href: `/api/exports?module=Purchasing&process=Goods+Received+Note+%28GRN%29&format=pdf&grnId=${row.id}`, group: "GRNs" });
  for (const row of lookups[5].data ?? []) {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    results.push({ id: `receipt:${row.id}`, label: row.payment_number, hint: `KES ${Number(row.amount_received || 0).toLocaleString("en-KE")} ${customer?.customer_name || ""}`, href: `/sales?historyCustomer=${encodeURIComponent(customer?.customer_name || "")}`, group: "Receipts" });
  }
  return { results, partial: lookups.some((lookup) => Boolean(lookup.error)) };
}
