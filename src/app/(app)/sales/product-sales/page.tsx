import Link from "next/link";
import { Download, FileText, Printer } from "lucide-react";
import { SearchableSelect } from "@/components/app/searchable-select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";
import { productSalesPeriod } from "@/lib/sales-metrics";
import { loadProductSales, summarizeProductSales } from "@/lib/product-sales-data";

const quantity = (value: number) => value.toLocaleString("en-KE", { maximumFractionDigits: 2 });
const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ProductSalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const param = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = param("date") || today;
  const period = ["daily", "weekly", "monthly", "yearly", "custom"].includes(param("period")) ? param("period") : "monthly";
  const productId = param("productId");
  let error = "";
  let window = productSalesPeriod("monthly", today);
  try { window = productSalesPeriod(period, date, param("from"), param("to")); } catch (cause) { error = cause instanceof Error ? cause.message : "Invalid reporting dates."; }
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  const businessId = await getActiveBusinessId() || user?.app_metadata.active_business_id;
  const { data: products } = typeof businessId === "string" ? await client.from("products").select("id,product_name,sku").eq("business_id", businessId).order("product_name").limit(1000) : { data: [] };
  let rows: Awaited<ReturnType<typeof loadProductSales>> = [];
  if (typeof businessId === "string" && user && !error) {
    try { rows = await loadProductSales(client, businessId, window.start, window.end, productId); } catch (cause) { error = cause instanceof Error ? cause.message : "Could not load product sales."; }
  }
  const summary = summarizeProductSales(rows);
  const units = new Map<string, number>();
  for (const row of rows) units.set(row.unit, (units.get(row.unit) || 0) + row.quantity);
  const totalSales = rows.reduce((sum, row) => sum + row.amount, 0);
  const invoiceCount = new Set(rows.map((row) => row.invoiceId)).size;
  return <div className="pb-20">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Product sales</h1><Link href="/sales" className="text-sm font-semibold text-blue-700">Back to sales</Link></div>
    <form action="/sales/product-sales" className="mt-5 grid gap-3 border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
      <input type="hidden" name="module" value="Sales" /><input type="hidden" name="process" value="Product Quantity Sales Report" />
      <label className="text-sm font-semibold">Product<SearchableSelect key={productId} name="productId" label="Product" allLabel="All products" defaultValue={productId} options={(products || []).map((product) => ({ id: product.id, label: `${product.product_name}${product.sku ? ` - ${product.sku}` : ""}` }))} /></label>
      <label className="grid content-start gap-2 text-sm font-semibold">Period<select name="period" defaultValue={period} className="min-h-11 rounded-md border border-slate-300 px-3">{[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"], ["custom", "Custom dates"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid content-start gap-2 text-sm font-semibold">Report date<input type="date" name="date" defaultValue={date} required className="min-h-11 rounded-md border border-slate-300 px-3" /></label>
      <label className="grid content-start gap-2 text-sm font-semibold">Custom from<input type="date" name="from" defaultValue={param("from") || window.start} className="min-h-11 rounded-md border border-slate-300 px-3" /></label>
      <label className="grid content-start gap-2 text-sm font-semibold">Custom to<input type="date" name="to" defaultValue={param("to") || window.end} className="min-h-11 rounded-md border border-slate-300 px-3" /></label>
      <div className="flex flex-wrap gap-2 md:col-span-3 xl:col-span-5">
        <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white"><FileText className="h-4 w-4" />View report</button>
        {[["pdf", "PDF"], ["excel", "Excel"], ["print", "Print"]].map(([value, label]) => <button key={value} type="submit" formAction="/api/exports" formTarget="_blank" name="format" value={value} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold">{value === "print" ? <Printer className="h-4 w-4" /> : <Download className="h-4 w-4" />}{label}</button>)}
      </div>
    </form>
    <p className="mt-4 text-sm font-semibold text-slate-600">{window.label}</p>
    {error ? <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : <>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{[["Quantity sold", Array.from(units, ([unit, amount]) => `${quantity(amount)} ${unit}`).join(" · ") || "0"], ["Sales", money(totalSales)], ["Invoices", quantity(invoiceCount)]].map(([label, value]) => <div key={label} className="border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
      <div className="mt-5 overflow-x-auto border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-100"><tr>{["Product", "SKU", "Unit", "Quantity sold", "Invoices", "Sales"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{summary.map((row) => <tr key={`${row.sku}:${row.product}:${row.unit}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{row.product}</td><td className="px-4 py-3">{row.sku}</td><td className="px-4 py-3">{row.unit}</td><td className="px-4 py-3 font-semibold">{quantity(row.quantity)}</td><td className="px-4 py-3">{row.invoiceCount}</td><td className="px-4 py-3">{money(row.amount)}</td></tr>)}</tbody></table>{!rows.length ? <p className="p-4 text-sm text-slate-500">No posted product sales in this period.</p> : null}</div>
      <details className="mt-5 border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Invoice details ({rows.length} rows)</summary><div className="mt-3 max-h-[65vh] overflow-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead><tr>{["Date", "Invoice", "Customer", "Product", "SKU", "Unit", "Quantity", "Sales"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2"><a href={`/api/exports?module=Sales&process=Invoice&format=pdf&invoiceId=${row.invoiceId}`} className="text-blue-700 underline">{row.invoice}</a></td><td className="px-3 py-2">{row.customer}</td><td className="px-3 py-2">{row.product}</td><td className="px-3 py-2">{row.sku}</td><td className="px-3 py-2">{row.unit}</td><td className="px-3 py-2">{quantity(row.quantity)}</td><td className="px-3 py-2">{money(row.amount)}</td></tr>)}</tbody></table></div></details>
    </>}
  </div>;
}
