"use client";

import { useMemo, useState } from "react";
import { completeProcessAction } from "@/app/(app)/actions";
import { distributorQuickSetup, productSetupSections, productTypes } from "@/lib/inventory-data";

function fieldKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
}

function HiddenLabel({ name, label }: { name: string; label: string }) {
  return <input type="hidden" name={`label_${name}`} value={label} />;
}

function TextInput({
  label,
  type = "text",
  required = false,
  placeholder,
  min,
  step,
}: {
  label: string;
  type?: "text" | "number" | "date" | "url";
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  const key = fieldKey(label);
  return (
    <label className="text-sm font-medium">
      {label}
      <HiddenLabel name={key} label={label} />
      <input
        name={`field_${key}`}
        type={type}
        required={required}
        min={min}
        step={step}
        className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
        placeholder={placeholder ?? label}
      />
    </label>
  );
}

function SelectInput({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  const key = fieldKey(label);
  return (
    <label className="text-sm font-medium">
      {label}
      <HiddenLabel name={key} label={label} />
      <select name={`field_${key}`} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue={defaultValue ?? options[0]}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxInput({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  const key = fieldKey(label);
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
      <HiddenLabel name={key} label={label} />
      <input name={`field_${key}`} value="yes" type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function sectionSummary(section: string) {
  const summaries: Record<string, string> = {
    "Basic Details": "Name, code, barcode and short identity.",
    Classification: "Type, category, brand and manufacturer.",
    "Units & Packaging": "Selling unit, purchase unit and pack conversion.",
    "Inventory Tracking": "Stock, batches, expiry, serials and packaging.",
    "Pricing Foundation": "Cost, selling price and minimum margin guardrails.",
    "Tax Setup": "VAT treatment for vatable, zero-rated, exempt or out-of-scope items.",
    "Reorder Settings": "Minimums, reorder quantity, lead time and max stock.",
    "Batch & Expiry": "Shelf life, batch reference and expiry reminders.",
    Images: "Product image or logo reference for catalogues and documents.",
    "Advanced Settings": "Operational defaults and business-specific notes.",
  };
  return summaries[section] ?? "Complete this setup area.";
}

export function ProductSetupForm() {
  const [active, setActive] = useState(productSetupSections[0]);
  const activeIndex = productSetupSections.indexOf(active);
  const nextSection = productSetupSections[activeIndex + 1];
  const previousSection = productSetupSections[activeIndex - 1];
  const progress = useMemo(() => Math.round(((activeIndex + 1) / productSetupSections.length) * 100), [activeIndex]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr_320px]">
      <aside className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Setup progress</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {productSetupSections.map((section, index) => {
          const isActive = section === active;
          return (
            <button
              key={section}
              type="button"
              onClick={() => setActive(section)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left last:border-b-0 ${isActive ? "text-slate-950" : "text-slate-600 hover:text-slate-950"}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md text-xs font-semibold ${isActive ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}>{index + 1}</span>
              <span>
                <span className="block text-sm font-semibold">{section}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{sectionSummary(section)}</span>
              </span>
            </button>
          );
        })}
      </aside>

      <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Inventory" />
        <input type="hidden" name="process" value="New Product" />
        <input type="hidden" name="intent" value="Product saved" />
        <input type="hidden" name="returnTo" value="/inventory/products/new" />
        <input type="hidden" name="next" value="Add another product" />

        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Step {activeIndex + 1} of {productSetupSections.length}</p>
            <h2 className="mt-1 text-xl font-semibold">{active}</h2>
            <p className="mt-1 text-sm text-slate-600">{sectionSummary(active)}</p>
          </div>
          <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save product</button>
        </div>

        <div className={active === "Basic Details" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Product name" />
          <TextInput label="Short name" />
          <TextInput label="Product code" />
          <TextInput label="SKU" />
          <TextInput label="Barcode" />
          <TextInput label="Description" />
        </div>

        <div className={active === "Classification" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <SelectInput label="Product type" options={productTypes} defaultValue="Stock Item" />
          <TextInput label="Category" placeholder="Example: Soft drinks, Water, Energy drinks" />
          <TextInput label="Brand" placeholder="Example: Coca-Cola, Aquamist, Predator" />
          <TextInput label="Manufacturer" />
        </div>

        <div className={active === "Units & Packaging" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <SelectInput label="Base stock unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Bottle" />
          <SelectInput label="Purchase unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Crate" />
          <SelectInput label="Selling unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Bottle" />
          <TextInput label="Units per purchase pack" type="number" min="0" step="0.01" placeholder="Example: 24" />
          <TextInput label="Pack barcode" />
          <TextInput label="Pack SKU" />
        </div>

        <div className={active === "Inventory Tracking" ? "mt-5 grid gap-3 md:grid-cols-2" : "hidden"}>
          <CheckboxInput label="Track inventory" defaultChecked />
          <CheckboxInput label="Track batches" />
          <CheckboxInput label="Track expiry" />
          <CheckboxInput label="Track serial numbers" />
          <CheckboxInput label="Track returnable packaging" />
          <CheckboxInput label="Create opening stock after save" />
          <TextInput label="Opening stock quantity" type="number" min="0" step="0.01" />
          <TextInput label="Opening stock unit cost" type="number" min="0" step="0.01" />
        </div>

        <div className={active === "Pricing Foundation" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Standard cost" type="number" min="0" step="0.01" />
          <TextInput label="Selling price placeholder" type="number" min="0" step="0.01" />
          <TextInput label="Minimum selling price" type="number" min="0" step="0.01" />
          <TextInput label="Wholesale price level" type="number" min="0" step="0.01" />
          <TextInput label="Retail price level" type="number" min="0" step="0.01" />
        </div>

        <div className={active === "Tax Setup" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <SelectInput label="VAT treatment" options={["VAT_STD", "VAT_ZERO", "VAT_EXEMPT", "VAT_OUT_OF_SCOPE"]} defaultValue="VAT_STD" />
          <SelectInput label="Purchase VAT treatment" options={["VAT_STD", "VAT_ZERO", "VAT_EXEMPT", "VAT_OUT_OF_SCOPE"]} defaultValue="VAT_STD" />
          <TextInput label="Tax category" placeholder="Example: Standard rated goods" />
          <CheckboxInput label="eTIMS sales item" defaultChecked />
        </div>

        <div className={active === "Reorder Settings" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Reorder level" type="number" min="0" step="0.01" />
          <TextInput label="Reorder quantity" type="number" min="0" step="0.01" />
          <TextInput label="Maximum stock level" type="number" min="0" step="0.01" />
          <TextInput label="Lead time days" type="number" min="0" step="1" />
          <TextInput label="Preferred supplier" />
        </div>

        <div className={active === "Batch & Expiry" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Shelf life days" type="number" min="0" step="1" />
          <TextInput label="Default batch prefix" />
          <TextInput label="Expiry warning days" type="number" min="0" step="1" />
          <TextInput label="Manufacturing date" type="date" />
        </div>

        <div className={active === "Images" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Product image URL" type="url" placeholder="https://..." />
          <TextInput label="Catalogue image notes" />
        </div>

        <div className={active === "Advanced Settings" ? "mt-5 grid gap-4 md:grid-cols-2" : "hidden"}>
          <TextInput label="Weight" type="number" min="0" step="0.001" />
          <TextInput label="Volume" type="number" min="0" step="0.001" />
          <TextInput label="Internal notes" />
          <SelectInput label="Product status" options={["Active", "Inactive"]} defaultValue="Active" />
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={!previousSection}
            onClick={() => previousSection && setActive(previousSection)}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <div className="flex flex-wrap gap-3">
            {nextSection ? (
              <button type="button" onClick={() => setActive(nextSection)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                Next: {nextSection}
              </button>
            ) : null}
            <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save product</button>
          </div>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Distributor quick setup</h2>
          <div className="mt-3 space-y-2">
            {distributorQuickSetup.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                <input name={`field_quick_${fieldKey(item)}`} value="yes" type="checkbox" />
                {item}
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pack conversion example</h2>
          <p className="mt-2 text-sm text-slate-600">1 crate = 24 bottles. Receiving 10 crates posts 240 bottles to the ledger.</p>
        </section>
      </aside>
    </div>
  );
}
