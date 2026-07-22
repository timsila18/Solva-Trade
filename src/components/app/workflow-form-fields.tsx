"use client";

import { useMemo, useState } from "react";
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

  const calculated = useMemo(() => {
    const base = calculationBase(values);
    const taxRate = defaultVatRate(values);
    const discount = parseNumber(values.discount);
    const manualTax = parseNumber(values.tax);
    const shouldAutoTax = base > 0 && !values.tax;
    const tax = shouldAutoTax ? Math.max(0, (base - discount) * (taxRate / 100)) : manualTax;
    const total = Math.max(0, base - discount + tax);
    return {
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map(({ label, key, type }) => {
        const selectedProduct = products.find((product) => product.name === values.product || product.id === values.product_id);
        const selectedCustomer = customers.find((customer) => customer.name === values.customer || customer.id === values.customer_id);
        const selectedInvoice = unpaidInvoices.find((invoice) => invoice.number === values.invoice || invoice.id === values.invoice_id);
        const isCustomerField = key === "customer";
        const isSupplierField = key === "supplier" || key === "preferred_supplier";
        const isProductField = key === "product";
        const isInvoiceField = key === "invoice";
        const selectedSupplier = suppliers.find((supplier) => supplier.name === values[key] || supplier.id === values.supplier_id);
        const resolvedType =
          type === "text" && /^(subtotal|total|tax|amount|balance_due|discount|price|unit_price|quantity)$/.test(key) ? "number" : type;
        const isCalculated =
          ["tax", "total", "balance_due", "new_quantity"].includes(key) &&
          key in calculated &&
          calculated[key as keyof typeof calculated] !== "";
        const defaultCalculatedValue =
          ["vat_rate", "tax_rate"].includes(key) && !values[key] ? calculated[key as keyof typeof calculated] : undefined;
        const value = isCalculated ? calculated[key as keyof typeof calculated] : defaultCalculatedValue ?? values[key] ?? "";
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
              <input type="hidden" name="field_supplier_id" value={selectedSupplier?.id ?? ""} />
              <input type="hidden" name="label_supplier_id" value="Supplier ID" />
              <input
                name={`field_${key}`}
                list="supplier-options"
                required={key === "supplier"}
                value={values[key] ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  const supplier = suppliers.find((item) => item.name === next || item.code === next || item.phone === next);
                  setValues((current) => ({ ...current, [key]: next, supplier_id: supplier?.id ?? "" }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Search supplier by name, code or phone"
              />
              <datalist id="supplier-options">
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.code} {supplier.phone ? `- ${supplier.phone}` : ""} - {supplier.type.replaceAll("_", " ")}
                  </option>
                ))}
              </datalist>
              {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
            </label>
          );
        }

        if (key === "source_type") {
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <select
                name={`field_${key}`}
                value={values[key] ?? "direct_supplier"}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="direct_supplier">Direct supplier</option>
                <option value="local_market">Local market supplier</option>
                <option value="spot_purchase">Spot purchase</option>
                <option value="alternative_supplier">Alternative supplier</option>
                <option value="emergency_purchase">Emergency purchase</option>
              </select>
              <span className="mt-1 block text-xs text-slate-500">Used for direct-vs-local price and profit reports.</span>
            </label>
          );
        }

        if (isProductField && products.length > 0) {
          return (
            <label key={label} className="text-sm font-medium">
              {label}
              <input type="hidden" name={`label_${key}`} value={label} />
              <input type="hidden" name="field_product_id" value={selectedProduct?.id ?? ""} />
              <input type="hidden" name="label_product_id" value="Product ID" />
              <input type="hidden" name="field_product_available_stock" value={selectedProduct ? String(selectedProduct.available) : ""} />
              <input type="hidden" name="label_product_available_stock" value="Available stock" />
              <input type="hidden" name="field_tax_code" value={selectedProduct?.vatCode ?? values.tax_code ?? ""} />
              <input type="hidden" name="label_tax_code" value="Tax code" />
              <input
                name={`field_${key}`}
                list="product-options"
                required
                value={values[key] ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  const product = products.find((item) => item.name === next || item.code === next);
                  setValues((current) => ({
                    ...current,
                    [key]: next,
                    product_id: product?.id ?? "",
                    unit_price: autoFillProductPrice && product?.price ? String(product.price) : current.unit_price,
                    price: autoFillProductPrice && product?.price ? String(product.price) : current.price,
                    vat_rate: product ? String(product.vatRate) : current.vat_rate,
                    tax_code: product?.vatCode ?? current.tax_code,
                  }));
                }}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Search product by name or code"
              />
              <datalist id="product-options">
                {products.map((product) => (
                  <option key={product.id} value={product.name}>
                    {product.code} - Stock {product.available} - VAT {product.vatRate}%
                  </option>
                ))}
              </datalist>
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
              required={/(customer|supplier|product|date|number|total|amount)/i.test(label)}
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
