"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

function inclusiveTaxAmount(inclusiveAmount: number, vatRate: number) {
  if (inclusiveAmount <= 0 || vatRate <= 0) return 0;
  return inclusiveAmount * (vatRate / (100 + vatRate));
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesSearch(values: unknown[], query: string) {
  return searchScore(values, query) >= 0;
}

function searchScore(values: unknown[], query: string) {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const haystack = values.map(normalizeSearch);
  if (!tokens.every((token) => haystack.some((value) => value.includes(token)))) return -1;
  return tokens.every((token) => haystack.some((value) => value.startsWith(token))) ? 2 : 1;
}

export function MultiLineTransactionForm({ mode, customers = [], suppliers = [], products, today }: Props) {
  const [search, setSearch] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [saleSourceSearch, setSaleSourceSearch] = useState("");
  const [saleSourceSupplierId, setSaleSourceSupplierId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(() => new Set());
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const summaryRefs = {
    quantity: useRef<HTMLParagraphElement>(null),
    subtotal: useRef<HTMLParagraphElement>(null),
    tax: useRef<HTMLParagraphElement>(null),
    total: useRef<HTMLParagraphElement>(null),
  };

  function setField(form: HTMLFormElement, name: string, value: string) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) field.value = value;
  }

  function fieldNumber(form: HTMLFormElement, name: string) {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement ? numberValue(field.value) : 0;
  }

  function recalculate(target: EventTarget | null) {
    const element = target instanceof HTMLElement ? target : null;
    const form = element?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    const summary = products.reduce(
      (current, product, index) => {
        const checkbox = form.elements.namedItem(`field_line_${index}_selected`);
        const isSelected = checkbox instanceof HTMLInputElement && checkbox.checked;
        const quantity = fieldNumber(form, `field_line_${index}_quantity`);
        const unitValue = fieldNumber(form, `field_line_${index}_${mode === "sale" ? "unit_price" : "unit_cost"}`);
        const discount = fieldNumber(form, `field_line_${index}_discount`);
        const rejectedQuantity = fieldNumber(form, `field_line_${index}_rejected_quantity`);
        const acceptedQuantity = Math.max(0, quantity - rejectedQuantity);
        const lineInclusive = Math.max(0, quantity * unitValue - discount);
        const lineTax = mode === "sale" ? inclusiveTaxAmount(lineInclusive, product.vatRate ?? 0) : 0;
        const lineSubtotal = mode === "sale" ? lineInclusive - lineTax : acceptedQuantity * unitValue;
        const lineTotal = mode === "sale" ? lineInclusive : lineSubtotal;
        setField(form, `field_line_${index}_tax_amount`, lineTax.toFixed(2));
        setField(form, `field_line_${index}_line_total`, lineTotal.toFixed(2));
        setField(form, `field_line_${index}_line_subtotal`, lineSubtotal.toFixed(2));
        const taxDisplay = form.querySelector(`[data-line-tax="${index}"]`);
        if (taxDisplay) taxDisplay.textContent = mode === "sale" ? "Included" : money(lineTax);
        const display = form.querySelector(`[data-line-total="${index}"]`);
        if (display) display.textContent = money(lineTotal);
        if (!isSelected) return current;
        return {
          quantity: current.quantity + (mode === "sale" ? quantity : acceptedQuantity),
          subtotal: current.subtotal + lineSubtotal,
          tax: current.tax + lineTax,
          total: current.total + lineTotal,
        };
      },
      { quantity: 0, subtotal: 0, tax: 0, total: 0 },
    );

    setField(form, "field_subtotal", summary.subtotal.toFixed(2));
    setField(form, "field_tax", summary.tax.toFixed(2));
    setField(form, "field_total", summary.total.toFixed(2));
    if (summaryRefs.quantity.current) summaryRefs.quantity.current.textContent = money(summary.quantity);
    if (summaryRefs.subtotal.current) summaryRefs.subtotal.current.textContent = `KES ${money(summary.subtotal)}`;
    if (summaryRefs.tax.current) summaryRefs.tax.current.textContent = `KES ${money(summary.tax)}`;
    if (summaryRefs.total.current) summaryRefs.total.current.textContent = `KES ${money(summary.total)}`;
  }

  const sharedDateName = mode === "sale" ? "field_invoice_date" : "field_received_date";
  const sharedDateLabel = mode === "sale" ? "Invoice date" : "Received date";
  const partyLabel = mode === "sale" ? "Customer" : "Supplier";
  const partyName = mode === "sale" ? "field_customer_id" : "field_supplier_id";
  const partyOptions = mode === "sale" ? customers : suppliers;
  const filteredPartyOptions = useMemo(() => {
    return partyOptions
      .map((party) => ({
        party,
        score: selectedPartyId && party.id === selectedPartyId ? 3 : searchScore([party.name, party.code, party.phone], partySearch),
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score || a.party.name.localeCompare(b.party.name))
      .map(({ party }) => party);
  }, [partyOptions, partySearch, selectedPartyId]);
  const filteredSaleSourceSuppliers = useMemo(() => {
    return suppliers
      .map((supplier) => ({
        supplier,
        score: saleSourceSupplierId && supplier.id === saleSourceSupplierId ? 3 : searchScore([supplier.name, supplier.code, supplier.phone, supplier.type], saleSourceSearch),
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score || a.supplier.name.localeCompare(b.supplier.name))
      .map(({ supplier }) => supplier);
  }, [saleSourceSearch, saleSourceSupplierId, suppliers]);
  const matchingIndexes = useMemo(() => {
    return new Set(
      products
        .map((product, index) => ({ product, index }))
        .filter(({ product }) => searchScore([product.name, product.code, product.vatCode], search) >= 0)
        .sort((a, b) => searchScore([b.product.name, b.product.code, b.product.vatCode], search) - searchScore([a.product.name, a.product.code, a.product.vatCode], search))
        .map(({ index }) => index),
    );
  }, [products, search]);
  const visibleIndexes = useMemo(() => {
    return products
      .map((_, index) => index)
      .filter((index) => matchingIndexes.has(index) || selectedIndexes.has(index));
  }, [matchingIndexes, products, selectedIndexes]);

  function setLineSelected(index: number, selected: boolean) {
    setSelectedIndexes((current) => {
      const next = new Set(current);
      if (selected) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  const previewLines = useMemo(() => {
    return Array.from(selectedIndexes)
      .sort((a, b) => a - b)
      .map((index) => products[index])
      .filter(Boolean);
  }, [products, selectedIndexes]);

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    function trimUnselectedLineFields(event: Event) {
      if (!("formData" in event)) return;
      const formData = (event as FormDataEvent).formData;
      products.forEach((_, index) => {
        const selected = formData.get(`field_line_${index}_selected`);
        const quantity = numberValue(formData.get(`field_line_${index}_quantity`));
        const productId = String(formData.get(`field_line_${index}_product_id`) ?? "");
        if (productId && quantity > 0 && (selected === "yes" || selected === "on")) return;
        for (const key of Array.from(formData.keys())) {
          if (key.startsWith(`field_line_${index}_`)) formData.delete(key);
        }
      });
    }

    form.addEventListener("formdata", trimUnselectedLineFields);
    return () => form.removeEventListener("formdata", trimUnselectedLineFields);
  }, [products]);

  useEffect(() => {
    function handleDraftRestore() {
      const form = containerRef.current?.closest("form");
      if (form instanceof HTMLFormElement) recalculate(form);
    }

    window.addEventListener("solva:form-draft-restored", handleDraftRestore);
    return () => window.removeEventListener("solva:form-draft-restored", handleDraftRestore);
  });

  const returnTo = encodeURIComponent(pathname);
  const addPartyHref = mode === "sale" ? `/customers/new?returnTo=${returnTo}` : `/suppliers/new?returnTo=${returnTo}`;
  const addProductHref = `/inventory/products/new?returnTo=${returnTo}`;

  return (
    <div ref={containerRef} className="space-y-5">
      <input type="hidden" name="field_line_count" value={products.length} />
      <input type="hidden" name={`label_${mode === "sale" ? "customer_id" : "supplier_id"}`} value={partyLabel} />
      <input type="hidden" name={`label_${mode === "sale" ? "invoice_date" : "received_date"}`} value={sharedDateLabel} />
      <input type="hidden" name="field_subtotal" defaultValue="0.00" />
      <input type="hidden" name="field_tax" defaultValue="0.00" />
      <input type="hidden" name="field_total" defaultValue="0.00" />

      <section className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
          <span className="flex items-center justify-between gap-3">
            {partyLabel}
            <Link href={addPartyHref} className="text-xs font-semibold text-[var(--solva-blue-700)] underline-offset-4 hover:underline">
              Add missing {partyLabel.toLowerCase()}
            </Link>
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={partySearch}
              onChange={(event) => setPartySearch(event.currentTarget.value)}
              placeholder={`Search saved ${partyLabel.toLowerCase()}`}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-normal"
            />
          </div>
          <select
            name={partyName}
            required={mode !== "sale"}
            value={selectedPartyId}
            onChange={(event) => setSelectedPartyId(event.currentTarget.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="">Select saved {partyLabel.toLowerCase()}</option>
            {filteredPartyOptions.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name} {party.code ? `- ${party.code}` : ""}
              </option>
            ))}
          </select>
          {partySearch.trim() ? (
            <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
              {filteredPartyOptions.slice(0, 8).map((party) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => {
                    setSelectedPartyId(party.id);
                    setPartySearch(party.name);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm font-normal hover:bg-cyan-50"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">{party.name}</span>
                    <span className="text-xs text-slate-500">{[party.code, party.phone].filter(Boolean).join(" - ") || "Saved record"}</span>
                  </span>
                  <span className="text-xs font-semibold text-[var(--solva-blue-700)]">Use</span>
                </button>
              ))}
              {!filteredPartyOptions.length ? (
                <p className="px-3 py-2 text-xs font-normal text-slate-500">No saved {partyLabel.toLowerCase()} matches. Type the new customer name below or add one.</p>
              ) : null}
            </div>
          ) : null}
          {mode === "sale" ? (
            <>
              <input type="hidden" name="label_customer_name" value="Customer name" />
              <input
                name="field_customer_name"
                placeholder="Or type new customer name and continue"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </>
          ) : null}
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
        {mode === "sale" ? (
          <>
            <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
              Default profit source
              <select name="field_sale_source_type" defaultValue="auto_fifo" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="auto_fifo">Auto from received stock</option>
                <option value="direct_supplier">Direct supplier</option>
                <option value="local_market">Local market</option>
                <option value="tz_supplier">Tanzania Supplier</option>
                <option value="spot_purchase">Spot purchase</option>
                <option value="alternative_supplier">Alternative supplier</option>
                <option value="emergency_purchase">Emergency purchase</option>
              </select>
              <input type="hidden" name="label_sale_source_type" value="Default profit source" />
            </label>
            <label className="grid gap-2 text-sm font-semibold lg:col-span-2">
              Source supplier override
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={saleSourceSearch}
                  onChange={(event) => setSaleSourceSearch(event.currentTarget.value)}
                  placeholder="Optional: search supplier if this sale should be tagged"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-normal"
                />
              </div>
              <select
                name="field_sale_source_supplier_id"
                value={saleSourceSupplierId}
                onChange={(event) => setSaleSourceSupplierId(event.currentTarget.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Use FIFO supplier automatically</option>
                {filteredSaleSourceSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.code ? `- ${supplier.code}` : ""}
                  </option>
                ))}
              </select>
              <input type="hidden" name="label_sale_source_supplier_id" value="Source supplier override" />
              {saleSourceSearch.trim() ? (
                <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                  {filteredSaleSourceSuppliers.slice(0, 6).map((supplier) => (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => {
                        setSaleSourceSupplierId(supplier.id);
                        setSaleSourceSearch(supplier.name);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm font-normal hover:bg-cyan-50"
                    >
                      <span>
                        <span className="block font-semibold text-slate-900">{supplier.name}</span>
                        <span className="text-xs text-slate-500">{[supplier.code, supplier.type].filter(Boolean).join(" - ") || "Saved supplier"}</span>
                      </span>
                      <span className="text-xs font-semibold text-[var(--solva-blue-700)]">Tag</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
          </>
        ) : null}
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
          <span className="flex items-center justify-between gap-3">
            Search products
            <Link href={addProductHref} className="text-xs font-semibold text-[var(--solva-blue-700)] underline-offset-4 hover:underline">
              Add missing product
            </Link>
          </span>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={mode === "sale" ? "Search product to sell" : "Search delivered product"}
                className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm font-normal"
              />
            </div>
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                Show all
              </button>
            ) : null}
          </div>
        </label>
      </section>

      <section className="overflow-x-auto rounded-md border border-slate-200">
        <table className={`w-full border-collapse text-sm ${mode === "sale" ? "min-w-[1180px]" : "min-w-[980px]"}`}>
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="w-12 px-3 py-3">Use</th>
              <th className="min-w-64 px-3 py-3">Product</th>
              <th className="px-3 py-3">Available</th>
              <th className="px-3 py-3">{mode === "sale" ? "Quantity" : "Received qty"}</th>
              <th className="px-3 py-3">{mode === "sale" ? "Selling price (VAT included)" : "Unit cost"}</th>
              {mode === "sale" ? <th className="px-3 py-3">Discount</th> : <th className="px-3 py-3">Rejected</th>}
              <th className="px-3 py-3">{mode === "sale" ? "VAT basis" : "Batch"}</th>
              {mode === "sale" ? <th className="px-3 py-3">Source</th> : null}
              <th className="px-3 py-3">{mode === "sale" ? "Line total" : "Expiry"}</th>
            </tr>
          </thead>
          <tbody>
            {visibleIndexes.map((index) => {
              const product = products[index];
              const productName = product.name || "Unnamed product";
              const productCode = product.code || "";
              const defaultUnitValue = mode === "sale" && product.price > 0 ? product.price : 0;
              const quantity = 0;
              const unitValue = defaultUnitValue;
              const discount = 0;
              const saleTotal = Math.max(0, quantity * unitValue - discount);
              const tax = inclusiveTaxAmount(saleTotal, product.vatRate ?? 0);
              const saleSubtotal = saleTotal - tax;
              const accepted = quantity;
              const receiptTotal = accepted * unitValue;
              return (
                <tr key={product.id || index} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      name={`field_line_${index}_selected`}
                      value="yes"
                      checked={selectedIndexes.has(index)}
                      onChange={(event) => {
                        setLineSelected(index, event.currentTarget.checked);
                        recalculate(event.currentTarget);
                      }}
                      className="h-4 w-4"
                    />
                    <input type="hidden" name={`field_line_${index}_product_id`} value={product.id || ""} />
                    <input type="hidden" name={`field_line_${index}_product_name`} value={productName} />
                    <input type="hidden" name={`field_line_${index}_product_code`} value={productCode} />
                    <input type="hidden" name={`field_line_${index}_tax_rate`} value={product.vatRate ?? 0} />
                    <input type="hidden" name={`field_line_${index}_tax_amount`} defaultValue={mode === "sale" ? tax.toFixed(2) : "0"} />
                    <input type="hidden" name={`field_line_${index}_line_subtotal`} defaultValue={mode === "sale" ? saleSubtotal.toFixed(2) : "0"} />
                    <input type="hidden" name={`field_line_${index}_line_total`} defaultValue={(mode === "sale" ? saleTotal : receiptTotal).toFixed(2)} />
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
                      defaultValue=""
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        const form = event.currentTarget.form;
                        const checkbox = form?.elements.namedItem(`field_line_${index}_selected`);
                        if (numberValue(value) > 0 && checkbox instanceof HTMLInputElement) {
                          checkbox.checked = true;
                          setLineSelected(index, true);
                        }
                        recalculate(event.currentTarget);
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
                      defaultValue={defaultUnitValue ? String(defaultUnitValue) : ""}
                      onChange={(event) => recalculate(event.currentTarget)}
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
                        defaultValue=""
                        onChange={(event) => recalculate(event.currentTarget)}
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
                        defaultValue=""
                        onChange={(event) => recalculate(event.currentTarget)}
                        className="w-28 rounded-md border border-slate-300 px-2 py-2"
                      />
                    </td>
                  )}
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle text-slate-600"><span data-line-tax={index}>Included</span></td>
                  ) : (
                    <td className="px-3 py-2 align-middle">
                      <input name={`field_line_${index}_batch`} placeholder="Batch" className="w-32 rounded-md border border-slate-300 px-2 py-2" />
                    </td>
                  )}
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle">
                      <select
                        name={`field_line_${index}_source_choice`}
                        defaultValue="auto_fifo"
                        className="w-40 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs"
                      >
                        <option value="auto_fifo">Auto/FIFO</option>
                        <option value="direct_supplier">Direct supplier</option>
                        <option value="local_market">Local market</option>
                        <option value="tz_supplier">Tanzania Supplier</option>
                      </select>
                    </td>
                  ) : null}
                  {mode === "sale" ? (
                    <td className="px-3 py-2 align-middle font-semibold"><span data-line-total={index}>{money(saleTotal)}</span></td>
                  ) : (
                    <td className="px-3 py-2 align-middle">
                      <input name={`field_line_${index}_expiry_date`} type="date" className="w-36 rounded-md border border-slate-300 px-2 py-2" />
                    </td>
                  )}
                </tr>
              );
            })}
            {!visibleIndexes.length ? (
              <tr>
                <td colSpan={mode === "sale" ? 9 : 8} className="bg-white px-4 py-8 text-center text-sm text-slate-600">
                  No products match that search. Clear the search or add the product first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {mode === "sale" ? (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-950">Preview before posting</p>
              <p className="text-xs leading-5 text-slate-500">Check selected products, quantities and prices before clicking Create invoice.</p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                recalculate(event.currentTarget);
                setShowPreview((current) => !current);
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800"
            >
              {showPreview ? "Hide preview" : "Preview sale"}
            </button>
          </div>
          {showPreview ? (
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">VAT</th>
                    <th className="px-3 py-2">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.length ? (
                    previewLines.map((product, index) => (
                      <tr key={product.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-950">{product.name}</td>
                        <td className="px-3 py-2 text-slate-600">{product.code || "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{product.vatCode || "VAT inclusive where applicable"}</td>
                        <td className="px-3 py-2 text-slate-600">{product.trackInventory ? money(product.available) : "Service"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-center text-sm text-slate-500">Tick products to preview the sale.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 rounded-md border border-cyan-100 bg-cyan-50 p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Selected qty</p>
          <p ref={summaryRefs.quantity} className="mt-1 text-xl font-semibold">0.00</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{mode === "sale" ? "Exclusive amount" : "Stock value"}</p>
          <p ref={summaryRefs.subtotal} className="mt-1 text-xl font-semibold">KES 0.00</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Tax</p>
          <p ref={summaryRefs.tax} className="mt-1 text-xl font-semibold">KES 0.00</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Document total</p>
          <p ref={summaryRefs.total} className="mt-1 text-xl font-semibold">KES 0.00</p>
        </div>
      </section>
    </div>
  );
}
