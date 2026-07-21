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
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function WorkflowFormFields({ fields }: { fields: string[] }) {
  const keys = useMemo(() => fields.map((field) => ({ label: field, key: fieldKey(field), type: fieldType(field) })), [fields]);
  const [values, setValues] = useState<Record<string, string>>({});

  const calculated = useMemo(() => {
    const quantity = parseNumber(values.quantity ?? values.ordered_quantity ?? values.received_quantity ?? values.return_quantity);
    const price = parseNumber(values.price ?? values.unit_price ?? values.unit_cost);
    const explicitSubtotal = parseNumber(values.subtotal);
    const discount = parseNumber(values.discount);
    const tax = parseNumber(values.tax);
    const base = explicitSubtotal || (quantity && price ? quantity * price : 0);
    const total = Math.max(0, base - discount + tax);
    return {
      subtotal: base ? String(base.toFixed(2)) : values.subtotal ?? "",
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
        const isCalculated = key in calculated && calculated[key as keyof typeof calculated] !== "";
        const value = isCalculated ? calculated[key as keyof typeof calculated] : values[key] ?? "";
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
