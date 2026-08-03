"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Printer, Search, X } from "lucide-react";

type CustomerOption = {
  id: string;
  customer_name: string;
  customer_code: string | null;
  phone: string | null;
};

type ProductOption = {
  id: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  default_selling_price_placeholder: number | string | null;
  vat_status: string | null;
  tax_category: string | null;
  active: boolean | null;
};

type CustomerCatalogueFormProps = {
  customers: CustomerOption[];
  products: ProductOption[];
};

function moneyValue(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
}

function productMatches(product: ProductOption, query: string) {
  if (!query) return true;
  const haystack = [product.product_name, product.product_code, product.sku, product.vat_status, product.tax_category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function CustomerCatalogueForm({ customers, products }: CustomerCatalogueFormProps) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCount = useMemo(() => products.filter((product) => productMatches(product, normalizedQuery)).length, [products, normalizedQuery]);

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Customers</p>
          <h1 className="mt-1 text-3xl font-semibold">Customer catalogue and price list</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Pick a customer, adjust prices for this catalogue only, then download a clean PDF, Excel or print copy to send.
          </p>
        </div>
        <Link href="/customers" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          Back to customers
        </Link>
      </div>

      <form action="/api/exports" method="post" target="_blank" className="mt-6 space-y-5">
        <input type="hidden" name="module" value="Customers" />
        <input type="hidden" name="process" value="Customer Price List" />
        <input type="hidden" name="line_count" value={products.length} />

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_220px]">
          <label className="grid gap-2 text-sm font-semibold">
            Customer receiving the catalogue
            <select name="customerId" required className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_name} {customer.customer_code ? `- ${customer.customer_code}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Price list date
            <input name="field_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" />
            <input type="hidden" name="label_date" value="Price list date" />
          </label>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div>
              <h2 className="font-semibold">Products and customer prices</h2>
              <p className="mt-1 text-sm text-slate-600">Untick anything you do not want to send. Edit the price column for customer-specific pricing.</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <label className="relative min-w-[260px] flex-1 lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        setQuery(draftQuery);
                      }
                    }}
                    placeholder="Search product, code or SKU"
                    className="min-h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setQuery(draftQuery)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftQuery("");
                      setQuery("");
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                ) : null}
              </div>
              <p className="text-xs font-medium text-slate-500">
                Showing {visibleCount.toLocaleString("en-KE")} of {products.length.toLocaleString("en-KE")} products. Hidden rows keep their selections and edited prices.
              </p>
              <div className="flex flex-wrap gap-2">
                <button name="format" value="pdf" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4" />
                  Download PDF
                </button>
                <button name="format" value="excel" className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-[var(--solva-blue-700)]">
                  Excel
                </button>
                <button name="format" value="print" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="w-14 px-3 py-3">Send</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Code / SKU</th>
                  <th className="px-3 py-3">Customer price</th>
                  <th className="px-3 py-3">VAT treatment</th>
                  <th className="px-3 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const vat = product.vat_status || product.tax_category || "VAT inclusive where applicable";
                  const matches = productMatches(product, normalizedQuery);
                  return (
                    <tr key={product.id} className={`border-b border-slate-100 odd:bg-white even:bg-slate-50 ${matches ? "" : "hidden"}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" name={`include_${index}`} value="yes" defaultChecked className="h-4 w-4" />
                        <input type="hidden" name={`product_id_${index}`} value={product.id} />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-950">{product.product_name}</td>
                      <td className="px-3 py-2 text-slate-600">{product.sku || product.product_code || "-"}</td>
                      <td className="px-3 py-2">
                        <input
                          name={`price_${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={moneyValue(product.default_selling_price_placeholder)}
                          className="w-36 rounded-md border border-slate-300 px-2 py-2"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{vat.replaceAll("_", " ")}</td>
                      <td className="px-3 py-2">
                        <input name={`note_${index}`} placeholder="Optional customer note" className="w-52 rounded-md border border-slate-300 px-2 py-2" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </form>
    </div>
  );
}
