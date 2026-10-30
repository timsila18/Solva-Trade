import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProductSale = { id: string; productId: string; product: string; sku: string; unit: string; quantity: number; amount: number; invoiceId: string; invoice: string; date: string; customer: string };
type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] : value;

export async function loadProductSales(client: Client, businessId: string, start: string, end: string, productId?: string | null): Promise<ProductSale[]> {
  const rows: ProductSale[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from("sales_invoice_items")
      .select("id, product_id, invoice_quantity, line_total, unit:units_of_measure!sales_invoice_items_unit_id_fkey(name,symbol), products(product_name,sku,product_code,unit:units_of_measure!products_base_unit_id_fkey(name,symbol)), sales_invoices!inner(id,invoice_number,invoice_date,status,customers(customer_name))")
      .eq("business_id", businessId)
      .in("sales_invoices.status", ["posted", "partially_paid", "paid", "overdue"])
      .gte("sales_invoices.invoice_date", start).lte("sales_invoices.invoice_date", end)
      .order("id").range(from, from + 999);
    if (productId && productId !== "all") query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load product sales. ${error.message}`);
    for (const item of data ?? []) {
      const invoice = one(item.sales_invoices);
      const product = one(item.products);
      const unit = one(item.unit) || one(product?.unit ?? null);
      if (!invoice) continue;
      rows.push({ id: item.id, productId: item.product_id, product: product?.product_name || "Product", sku: product?.sku || product?.product_code || "", unit: unit?.name || unit?.symbol || "Sale unit", quantity: Number(item.invoice_quantity) || 0, amount: Number(item.line_total) || 0, invoiceId: invoice.id, invoice: invoice.invoice_number, date: invoice.invoice_date, customer: one(invoice.customers)?.customer_name || "Customer" });
    }
    if (!data || data.length < 1000) return rows.sort((a, b) => a.date.localeCompare(b.date) || a.invoice.localeCompare(b.invoice) || a.product.localeCompare(b.product));
  }
}

export function summarizeProductSales(rows: ProductSale[]) {
  const groups = new Map<string, { product: string; sku: string; unit: string; quantity: number; amount: number; invoices: Set<string> }>();
  for (const row of rows) {
    const key = `${row.productId}:${row.unit}`;
    const current = groups.get(key) || { product: row.product, sku: row.sku, unit: row.unit, quantity: 0, amount: 0, invoices: new Set<string>() };
    current.quantity += row.quantity;
    current.amount += row.amount;
    current.invoices.add(row.invoiceId);
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((group) => ({ ...group, invoiceCount: group.invoices.size })).sort((a, b) => b.quantity - a.quantity || a.product.localeCompare(b.product));
}
