"use client";

import { useMemo, useState } from "react";

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

export function WorkflowFormFields({ fields }: { fields: string[] }) {
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
        const resolvedType =
          type === "text" && /^(subtotal|total|tax|amount|balance_due|discount|price|unit_price|quantity)$/.test(key) ? "number" : type;
        const isCalculated =
          ["tax", "total", "balance_due", "new_quantity"].includes(key) &&
          key in calculated &&
          calculated[key as keyof typeof calculated] !== "";
        const defaultCalculatedValue =
          ["vat_rate", "tax_rate"].includes(key) && !values[key] ? calculated[key as keyof typeof calculated] : undefined;
        const value = isCalculated ? calculated[key as keyof typeof calculated] : defaultCalculatedValue ?? values[key] ?? "";
        return (
          <label key={label} className="text-sm font-medium">
            {label}
            <input type="hidden" name={`label_${key}`} value={label} />
            <input
              name={`field_${key}`}
              type={resolvedType}
              inputMode={resolvedType === "number" ? "decimal" : undefined}
              min={resolvedType === "number" && !/variance|adjustment/i.test(label) ? "0" : undefined}
              step={resolvedType === "number" ? "0.01" : undefined}
              required={/(customer|supplier|product|date|number|total|amount)/i.test(label)}
              readOnly={isCalculated}
              value={value}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 read-only:bg-slate-100"
              placeholder={type === "date" ? undefined : label}
            />
          </label>
        );
      })}
    </div>
  );
}
