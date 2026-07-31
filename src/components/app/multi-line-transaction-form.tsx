"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { CustomerLookup, ProductLookup, SupplierLookup } from "@/lib/workflow-live-data";

type Mode = "sale" | "goods-received";

type Props = {
  mode: Mode;
  customers?: CustomerLookup[];
  suppliers?: SupplierLookup[];
  products: ProductLookup[];
  today: string;
};

function money(value: number) {
  return value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberValue(value: unknown) {
  const number = Number(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isFinite(number) ? number : 0;
}

export function MultiLineTransactionForm({ mode, customers = [], suppliers = [], products, today }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(products.map((product, index) => [index, mode === "sale" && product.price > 0 ? String(product.price) : ""])),
  );
  const [discounts, setDiscounts] = useState<Record<number, string>>({});
  const [rejected, setRejected] = useState<Record<number, string>>({});

  const totals = useMemo(() => {
    return products.reduce(
      (summary, product, index) => {
        if (!selected[index]) return summary;
        const quantity = numberValue(quantities[index]);
        const unitValue = numberValue(prices[index]);
        const discount = numberValue(discounts[index]);
        const rejectedQuantity = numberValue(rejected[index]);
        const acceptedQuantity = Math.max(0, quantity - rejectedQuantity);
        if (mode === "sale") {
          const subtotal = Math.max(0, quantity * unitValue - discount);
          const tax = subtotal * ((product.vatRate ?? 0) / 100);
          return { quantity: summary.quantity + quantity, subtotal: summary.subtotal + subtotal, tax: summary.tax + tax, total: summary.total + subtotal + tax };
        }
        const total = acceptedQuantity * unitValue;
        return { quantity: summary.quantity + acceptedQuantity, subtotal: summary.subtotal + total, tax: summary.tax, total: summary.total + total };
      },
      { quantity: 0, subtotal: 0, tax: 0, total: 0 },
    );
  }, [discounts, mode, prices, products, quantities, rejected, selected]);

  const sharedDateName = mode === "sale" ? "field_invoice_date" : "field_received_date";
  const sharedDateLabel = mode === "sale" ? "Invoice date" : "Received date";
  const partyLabel = mode === "sale" ? "Customer" : "Supplier";
  const partyName = mode === "sale" ? "field_customer_id" : "field_supplier_id";
  const partyOptions = mode === "sale" ? customers : suppliers;
  const searchableProducts = useMemo(() => {
    const query = search.toLowerCase().trim();
    return products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => {
        if (!query) return true;
        return [product.name, product.code, product.vatCode].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      });
  }, [products, search]);

  return (
    <div className="space-y-5">
      <input type="hidden" name="field_line_count" value={products.length} />
      <input type="hidden" name={`label_${mode === "sale" ? "customer_id" : "supplier_id"}`} value={partyLabel} />
      <input type="hidden" name={`label_${mode === "sale" ? "invoice_date" : "received_date"}`} value={sharedDateLabel} />
      <input type="hidden" name="field_subtotal" value={totals.subtotal.toFixed(2)} />
      <input type="hidden" name="field_tax" value={totals.tax.toFixed(2)} />
      <input type="hidden" name="field_total" value={totals.total.toFixed(2)} />

      <section className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
          {partyLabel}
          <select name={partyName} required className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="">Select saved {partyLabel.toLowerCase()}</option>
            {partyOptions.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name} {party.code ? `- ${party.code}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {sharedDateLabel}
          <input name={sharedDateName} type="date" required defaultValue={today} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
        </label>
        {mode === "sale" ? (
          <label className="grid gap-2 text-sm font-semibold">
            Due date
            <input name="field_due_date" type="date" defaultValue={today} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            <input type="hidden" name="label_due_date" value="Due date" />
          </label>
        ) : (
          <label className="grid gap-2 text-sm font-semibold">
            Purchase source
            <select name="field_source_type" defaultValue="direct_supplier" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="direct_supplier">Direct supplier</option>
              <option value="local_market">Local market</option>
              <option value="emergency_purchase">Emergency purchase</option>
              <option value="opening_stock">Opening stock</option>
            </select>
            <input type="hidden" name="label_source_type" value="Purchase source" />
          </label>
        )}
        {mode === "goods-received" ? (
          <>
            <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
              Supplier delivery note number
              <input name="field_supplier_delivery_note_number" placeholder="Supplier delivery note number" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
              <input type="hidden" name="label_supplier_delivery_note_number" value="Supplier delivery note number" />
            </label>
            <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
              Source reason
              <input name="field_source_reason" placeholder="Use when purchase source is not the usual direct supplier" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
              <input type="hidden" name="label_source_reason" value="Source reason" />
            </label>
          </>
        ) : null}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <label className="grid gap-2 text-sm font-semibold">
          Search products
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={mode === "sale" ? "Search product to sell" : "Search delivered product"}
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm font-normal"
              />
            </div>
            <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
              <Search className="h-4 w-4" />
              Search
            </button>
          </div>
        </label>
      </section>

      <section className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="w-12 px-3 py-3">Use</th>
              <th className="min-w-64 px-3 py-3">Product</th>
              <th className="px-3 py-3">Available</th>
              <th className="px-3 py-3">{mode === "sale" ? "Quantity" : "Received qty"}</th>
              <th className="px-3 py-3">{mode === "sale" ? "Unit price" : "Unit cost"}</th>
              {mode === "sale" ? <th className="px-3 py-3">Discount</th> : <th className="px-3 py-3">Rejected</th>}
              <th className="px-3 py-3">{mode === "sale" ? "VAT" : "Batch"}</th>
              <th className="px-3 py-3">{mode === "sale" ? "Line total" : "Expiry"}</th>
            </tr>
          </thead>
          <tbody>
            {searchableProducts.map(({ product, index }) => {
              const productName = product.name || "Unnamed product";
              const productCode = product.code || "";
              const quantity = numberValue(quantities[index]);
              const unitValue = numberValue(prices[index]);
              const discount = numberValue(discounts[index]);
              const tax = Math.max(0, quantity * unitValue - discount) * ((product.vatRate ?? 0) / 100);
              const saleTotal = Math.max(0, quantity * unitValue - discount + tax);
              const accepted = Math.max(0, quantity - numberValue(rejected[index]));
              const receiptTotal = accepted * unitValue;
              return (
                <tr key={product.id || index} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      name={`field_line_${index}_selected`}
                      value="yes"
                      checked={Boolean(selected[index])}
                      onChange={(event) => setSelected((current) => ({ ...current, [index]: event.target.checked }))}
                      className="h-4 w-4"
                    />
                    <input type="hidden" name={`field_line_${index}_product_id`} value={product.id || ""} />
                    <input type="hidden" name={`field_line_${index}_product_name`} value={productName} />
                    <input type="hidden" name={`field_line_${index}_product_code`} value={productCode} />
                    <input type="hidden" name={`field_line_${index}_tax_rate`} value={product.vatRate ?? 0} />
                    <input type="hidden" name={`field_line_${index}_tax_amount`} value={mode === "sale" ? tax.toFixed(2) : "0"} />
                    <input type="hidden" name={`field_line_${index}_line_total`} value={(mode === "sale" ? saleTotal : receiptTotal).toFixed(2)} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <p className="font-semibold text-slate-950">{productName}</p>
                    <p className="text-xs text-slate-500">{productCode || "No code"} {product.vatCode ? `- ${product.vatCode}` : ""}</p>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-600">{product.trackInventory ? money(product.available) : "Service"}</td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      name={`field_line_${index}_quantity`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={quantities[index] ?? ""}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setQuantities((current) => ({ ...current, [index]: value }));
                        if (numberValue(value) > 0) setSelected((current) => ({ ...current, [index]: true }));
                      }}
                      className="w-28 rounded-md border border-slate-300 px-2 py-2"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      name={`field_line_${index}_${mode === "sale" ? "unit_price" : "unit_cost"}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={prices[index] ?? ""}
                      onChange={(event) => setPrices((current) => ({ ...current, [index]: event.currentTarget.value }))}
                      className="w-32 rounded-md border border-slate-300 px-2 py-2"
                    />
                  </td>
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle">
                      <input
                        name={`field_line_${index}_discount`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={discounts[index] ?? ""}
                        onChange={(event) => setDiscounts((current) => ({ ...current, [index]: event.currentTarget.value }))}
                        className="w-28 rounded-md border border-slate-300 px-2 py-2"
                      />
                    </td>
                  ) : (
                    <td className="px-3 py-2 align-middle">
                      <input
                        name={`field_line_${index}_rejected_quantity`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={rejected[index] ?? ""}
                        onChange={(event) => setRejected((current) => ({ ...current, [index]: event.currentTarget.value }))}
                        className="w-28 rounded-md border border-slate-300 px-2 py-2"
                      />
                    </td>
                  )}
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle text-slate-600">{money(tax)}</td>
                  ) : (
                    <td className="px-3 py-2 align-middle">
                      <input name={`field_line_${index}_batch`} placeholder="Batch" className="w-32 rounded-md border border-slate-300 px-2 py-2" />
                    </td>
                  )}
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle font-semibold">{money(saleTotal)}</td>
                  ) : (
                    <td className="px-3 py-2 align-middle">
                      <input name={`field_line_${index}_expiry_date`} type="date" className="w-36 rounded-md border border-slate-300 px-2 py-2" />
                    </td>
                  )}
                </tr>
              );
            })}
            {!searchableProducts.length ? (
              <tr>
                <td colSpan={8} className="bg-white px-4 py-8 text-center text-sm text-slate-600">
                  No products match that search. Clear the search or add the product first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 rounded-md border border-cyan-100 bg-cyan-50 p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Selected qty</p>
          <p className="mt-1 text-xl font-semibold">{money(totals.quantity)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{mode === "sale" ? "Subtotal" : "Stock value"}</p>
          <p className="mt-1 text-xl font-semibold">KES {money(totals.subtotal)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Tax</p>
          <p className="mt-1 text-xl font-semibold">KES {money(totals.tax)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Document total</p>
          <p className="mt-1 text-xl font-semibold">KES {money(totals.total)}</p>
        </div>
      </section>
    </div>
  );
}
