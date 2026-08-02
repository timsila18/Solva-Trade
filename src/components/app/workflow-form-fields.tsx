"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomerLookup, InvoiceLookup, ProductLookup, SupplierLookup } from "@/lib/workflow-live-data";

function fieldKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
}

function fieldType(label: string): "date" | "number" | "text" {
  const value = label.toLowerCase();
  if (value === "subtotal") return "number";
  if (["date", "valid until", "needed by", "expected arrival", "expiry", "period", "as-of"].some((term) => value.includes(term))) return "date";
  if (
    [
      "quantity",
      "qty",
      "price",
      "cost",
      "tax",
      "total",
      "subtotal",
      "amount",
      "balance",
      "discount",
      "current",
      "over 90",
      "1-30",
      "31-60",
      "61-90",
      "rows accepted",
      "rows rejected",
      "stock",
      "rate",
      "value",
      "cash",
      "budget",
      "variance",
      "opening",
      "drawings",
      "capital",
      "profit",
    ].some((term) => value.includes(term))
  )
    return "number";
  return "text";
}

function parseNumber(value: string | undefined) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function defaultVatRate(values: Record<string, string>) {
  const rateValue = values.vat_rate ?? values.tax_rate;
  if (typeof rateValue === "string" && rateValue.trim() !== "") return parseNumber(rateValue);
  const code = `${values.tax_code ?? values.vat_code ?? ""}`.toLowerCase();
  if (/(zero|exempt|out|none|no tax|0)/.test(code)) return 0;
  return 16;
}

function calculationBase(values: Record<string, string>) {
  const quantity = parseNumber(values.quantity ?? values.ordered_quantity ?? values.received_quantity ?? values.return_quantity ?? values.quantity_sold);
  const price = parseNumber(values.price ?? values.unit_price ?? values.unit_cost ?? values.rate);
  const explicitSubtotal = parseNumber(values.subtotal);
  const explicitAmountBeforeTax = parseNumber(values.amount_before_tax ?? values.taxable_amount ?? values.net_amount);
  return explicitSubtotal || explicitAmountBeforeTax || (quantity && price ? quantity * price : 0);
}

function inclusiveVatAmount(inclusiveAmount: number, vatRate: number) {
  if (inclusiveAmount <= 0 || vatRate <= 0) return 0;
  return inclusiveAmount * (vatRate / (100 + vatRate));
}

export function WorkflowFormFields({
  fields,
  customers = [],
  products = [],
  unpaidInvoices = [],
  suppliers = [],
  autoFillProductPrice = true,
}: {
  fields: string[];
  customers?: CustomerLookup[];
  products?: ProductLookup[];
  unpaidInvoices?: InvoiceLookup[];
  suppliers?: SupplierLookup[];
  autoFillProductPrice?: boolean;
}) {
  const normalizedFields = useMemo(() => {
    const hasTax = fields.some((field) => fieldKey(field) === "tax");
    const hasRate = fields.some((field) => ["tax_rate", "vat_rate", "tax_code", "vat_code"].includes(fieldKey(field)));
    return hasTax && !hasRate ? [...fields.slice(0, fields.findIndex((field) => fieldKey(field) === "tax")), "VAT rate", ...fields.slice(fields.findIndex((field) => fieldKey(field) === "tax"))] : fields;
  }, [fields]);
  const keys = useMemo(() => normalizedFields.map((field) => ({ label: field, key: fieldKey(field), type: fieldType(field) })), [normalizedFields]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    function restoreControlledValues(event: Event) {
      const detail = (event as CustomEvent<{ values?: Record<string, string> }>).detail;
      const restoredValues = detail?.values ?? {};
      const nextValues: Record<string, string> = {};
      for (const [name, value] of Object.entries(restoredValues)) {
        if (!name.startsWith("field_")) continue;
        nextValues[name.slice("field_".length)] = value;
      }
      if (Object.keys(nextValues).length) setValues((current) => ({ ...current, ...nextValues }));
    }

    window.addEventListener("solva:form-draft-restored", restoreControlledValues);
    return () => window.removeEventListener("solva:form-draft-restored", restoreControlledValues);
  }, []);

  const calculated = useMemo(() => {
    const inclusiveBase = calculationBase(values);
    const taxRate = defaultVatRate(values);
    const discount = parseNumber(values.discount);
    const manualTax = parseNumber(values.tax);
    const total = Math.max(0, inclusiveBase - discount);
    const shouldAutoTax = total > 0 && !values.tax;
    const tax = shouldAutoTax ? inclusiveVatAmount(total, taxRate) : manualTax;
    const exclusiveBase = Math.max(0, total - tax);
    return {
      subtotal: exclusiveBase ? String(exclusiveBase.toFixed(2)) : values.subtotal ?? "",
      tax_rate: taxRate ? String(taxRate.toFixed(2)) : values.tax_rate ?? "",
      vat_rate: taxRate ? String(taxRate.toFixed(2)) : values.vat_rate ?? "",
      tax: tax ? String(tax.toFixed(2)) : values.tax ?? "",
      total: total ? String(total.toFixed(2)) : values.total ?? "",
      balance_due: total ? String(total.toFixed(2)) : values.balance_due ?? "",
      new_quantity:
        values.current_quantity || values.adjustment_quantity
          ? String((parseNumber(values.current_quantity) + parseNumber(values.adjustment_quantity)).toFixed(2))
          : values.new_quantity ?? "",
    };
  }, [values]);

  const visibleKeys = useMemo(() => new Set(keys.map((field) => field.key)), [keys]);
  const hiddenCalculatedFields = [
    ["subtotal", "Subtotal"],
    ["vat_rate", "VAT rate"],
    ["tax", "Tax"],
    ["total", "Total"],
    ["balance_due", "Balance due"],
  ].filter(([key]) => !visibleKeys.has(key) && calculated[key as keyof typeof calculated]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hiddenCalculatedFields.map(([key, label]) => (
        <span key={key} className="hidden">
          <input type="hidden" name={`label_${key}`} value={label} />
          <input type="hidden" name={`field_${key}`} value={calculated[key as keyof typeof calculated]} />
        </span>
      ))}
      {keys.map(({ label, key, type }) => {
        const selectedProduct = products.find((product) => product.name === values.product || product.id === values.product_id);
        const selectedCustomer = customers.find((customer) => customer.name === values.customer || customer.id === values.customer_id);
        const selectedInvoice = unpaidInvoices.find((invoice) => invoice.number === values.invoice || invoice.id === values.invoice_id);
        const isCustomerField = key === "customer";
        const isSupplierField = key === "supplier" || key === "preferred_supplier";
        const isProductField = key === "product";
        const isInvoiceField = key === "invoice";
        const supplierIdKey = key === "preferred_supplier" ? "preferred_supplier_id" : "supplier_id";
        const selectedSupplier = suppliers.find((supplier) => supplier.id === values[supplierIdKey] || supplier.name === values[key]);
        const resolvedType =
          type === "text" && /^(subtotal|total|tax|amount|balance_due|discount|price|unit_price|quantity)$/.test(key) ? "number" : type;
        const isCalculated =
          ["tax", "total", "balance_due", "new_quantity"].includes(key) &&
          key in calculated &&
          calculated[key as keyof typeof calculated] !== "";
        const today = new Date().toISOString().slice(0, 10);
        const defaultCalculatedValue =
          ["vat_rate", "tax_rate"].includes(key) && !values[key] ? calculated[key as keyof typeof calculated] : undefined;
        const defaultDateValue = key === "received_date" && !values[key] ? today : undefined;
        const value = isCalculated ? calculated[key as keyof typeof calculated] : defaultCalculatedValue ?? defaultDateValue ?? values[key] ?? "";
        const maxStock =
          selectedProduct?.trackInventory && /^(quantity|ordered_quantity|quantity_sold)$/.test(key)
            ? String(selectedProduct.available)
            : undefined;
        const helper =
          isProductField && selectedProduct
            ? `Available stock: ${selectedProduct.available.toLocaleString("en-KE")} - VAT: ${selectedProduct.vatCode} ${selectedProduct.vatRate}%`
            : isCustomerField && selectedCustomer
              ? `Saved customer - Code ${selectedCustomer.code}${selectedCustomer.balance ? ` - Balance KES ${selectedCustomer.balance.toLocaleString("en-KE")}` : ""}`
              : isInvoiceField && selectedInvoice
                ? `Outstanding balance KES ${selectedInvoice.balanceDue.toLocaleString("en-KE")}`
                : isSupplierField && selectedSupplier
                  ? `Saved supplier - ${selectedSupplier.code} - ${selectedSupplier.type.replaceAll("_", " ")}`
                : "";

        if (isCustomerField && customers.length > 0) {
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <input type="hidden" name="field_customer_id" value={selectedCustomer?.id ?? ""} />
              <input type="hidden" name="label_customer_id" value="Customer ID" />
              <input
                name={`field_${key}`}
                list="customer-options"
                required
                value={values[key] ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  const customer = customers.find((item) => item.name === next || item.code === next || item.phone === next);
                  setValues((current) => ({ ...current, [key]: next, customer_id: customer?.id ?? "" }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Search customer by name, code or phone"
              />
              <datalist id="customer-options">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.code} {customer.phone ? `- ${customer.phone}` : ""}
                  </option>
                ))}
              </datalist>
              {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
            </label>
          );
        }

        if (isSupplierField && suppliers.length > 0) {
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <input type="hidden" name={`field_${key}`} value={selectedSupplier?.name ?? ""} />
              <input type="hidden" name={`label_${supplierIdKey}`} value="Supplier ID" />
              <select
                name={`field_${supplierIdKey}`}
                required={key === "supplier"}
                value={values[supplierIdKey] ?? ""}
                onChange={(event) => {
                  const supplier = suppliers.find((item) => item.id === event.target.value);
                  setValues((current) => ({
                    ...current,
                    [key]: supplier?.name ?? "",
                    [supplierIdKey]: supplier?.id ?? "",
                  }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Select saved supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {supplier.code}{supplier.phone ? ` - ${supplier.phone}` : ""}
                  </option>
                ))}
              </select>
              {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
            </label>
          );
        }

        if (key === "source_type" || key === "purchase_source") {
          const sourceValue = values.source_type ?? "direct_supplier";
          return (
            <label key={label} className="text-sm font-medium">
              Purchase source
              <input type="hidden" name="label_source_type" value="Purchase source" />
              <select
                name="field_source_type"
                value={sourceValue}
                onChange={(event) => setValues((current) => ({ ...current, source_type: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="direct_supplier">Direct supplier</option>
                <option value="local_market">Local market supplier</option>
                <option value="spot_purchase">Spot purchase</option>
                <option value="alternative_supplier">Alternative supplier</option>
                <option value="emergency_purchase">Emergency purchase</option>
              </select>
              <span className="mt-1 block text-xs text-slate-500">Choose where these goods came from. Use Local market only when the item was bought outside the usual direct supplier.</span>
            </label>
          );
        }

        if (isProductField && products.length > 0) {
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <input type="hidden" name="label_product_id" value="Product ID" />
              <input type="hidden" name="field_product_available_stock" value={selectedProduct ? String(selectedProduct.available) : ""} />
              <input type="hidden" name="label_product_available_stock" value="Available stock" />
              <input type="hidden" name="field_tax_code" value={selectedProduct?.vatCode ?? values.tax_code ?? ""} />
              <input type="hidden" name="label_tax_code" value="Tax code" />
              <input type="hidden" name={`field_${key}`} value={selectedProduct?.name ?? ""} />
              <select
                name="field_product_id"
                required
                value={values.product_id ?? ""}
                onChange={(event) => {
                  const product = products.find((item) => item.id === event.target.value);
                  setValues((current) => ({
                    ...current,
                    [key]: product?.name ?? "",
                    product_id: product?.id ?? "",
                    unit_price: autoFillProductPrice && product?.price ? String(product.price) : current.unit_price,
                    price: autoFillProductPrice && product?.price ? String(product.price) : current.price,
                    vat_rate: product ? String(product.vatRate) : current.vat_rate,
                    tax_code: product?.vatCode ?? current.tax_code,
                  }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Select saved product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.code} - Stock {product.available} - VAT {product.vatRate}%
                  </option>
                ))}
              </select>
              {helper ? <span className={`mt-1 block text-xs ${selectedProduct?.trackInventory && selectedProduct.available <= 0 ? "text-red-600" : "text-slate-500"}`}>{helper}</span> : null}
            </label>
          );
        }

        if (isInvoiceField && unpaidInvoices.length > 0) {
          const visibleInvoices = selectedCustomer?.id
            ? unpaidInvoices.filter((invoice) => invoice.customerId === selectedCustomer.id)
            : unpaidInvoices;
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <input type="hidden" name="field_invoice_id" value={selectedInvoice?.id ?? ""} />
              <input type="hidden" name="label_invoice_id" value="Invoice ID" />
              <input
                name={`field_${key}`}
                list="invoice-options"
                value={values[key] ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  const invoice = unpaidInvoices.find((item) => item.number === next);
                  setValues((current) => ({
                    ...current,
                    [key]: next,
                    invoice_id: invoice?.id ?? "",
                    customer_id: invoice?.customerId ?? current.customer_id,
                    customer: invoice?.customerName || current.customer,
                    amount: invoice?.balanceDue ? String(invoice.balanceDue) : current.amount,
                  }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Select unpaid invoice"
              />
              <datalist id="invoice-options">
                {visibleInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.number}>
                    {invoice.customerName} - Balance KES {invoice.balanceDue}
                  </option>
                ))}
              </datalist>
              {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
            </label>
          );
        }

        const optionalOperationalField =
          /^(discount|amount paid|payment method|source reason|supplier delivery note number|rejected quantity|batch|expiry date|direct reference unit cost|local reference unit cost|pack barcode|pack sku|barcode)$/i.test(
            label,
          );
        const requiredOperationalField =
          !optionalOperationalField &&
          (/(customer|supplier|product|total|amount|quantity|unit price|unit cost|received quantity)/i.test(label) ||
            (/(date)/i.test(label) && !/(expiry|due|valid until|expected)/i.test(label)));

        return (
          <label key={label} className="text-sm font-medium">
            {label}
            <input type="hidden" name={`label_${key}`} value={label} />
            <input
              name={`field_${key}`}
              type={resolvedType}
              inputMode={resolvedType === "number" ? "decimal" : undefined}
              min={resolvedType === "number" && !/variance|adjustment/i.test(label) ? "0" : undefined}
              max={maxStock}
              step={resolvedType === "number" ? "0.01" : undefined}
              required={requiredOperationalField}
              readOnly={isCalculated}
              value={value}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 read-only:bg-slate-100"
              placeholder={type === "date" ? undefined : label}
            />
            {maxStock ? <span className="mt-1 block text-xs text-slate-500">Cannot sell more than available stock: {maxStock}.</span> : null}
          </label>
        );
      })}
    </div>
  );
}
