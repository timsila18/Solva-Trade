"use client";

import { completeProcessAction } from "@/app/(app)/actions";
import { distributorQuickSetup, productTypes } from "@/lib/inventory-data";

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

function OptionalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-950">{title}</summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

export function ProductSetupForm() {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
      <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Inventory" />
        <input type="hidden" name="process" value="New Product" />
        <input type="hidden" name="intent" value="Product saved" />
        <input type="hidden" name="returnTo" value="/inventory/products/new" />
        <input type="hidden" name="next" value="Add another product" />
        <input type="hidden" name="field_track_inventory" value="yes" />
        <input type="hidden" name="label_track_inventory" value="Track inventory" />

        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Quick product setup</p>
            <h2 className="mt-1 text-xl font-semibold">Add the product and start selling</h2>
            <p className="mt-1 text-sm text-slate-600">Fill the essentials. Open advanced details only when the item needs them.</p>
          </div>
          <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save product</button>
        </div>

        <section className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Essentials</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <TextInput label="Product name" required placeholder="Example: Predator 500ml" />
            <TextInput label="Brand" placeholder="Example: Coca-Cola, Aquamist, Predator" />
            <TextInput label="Category" placeholder="Example: Soft drinks, Water, Energy drinks" />
            <SelectInput label="Product type" options={productTypes} defaultValue="Stock Item" />
            <SelectInput label="Base stock unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Bottle" />
            <TextInput label="Barcode" />
            <TextInput label="Selling price placeholder" type="number" min="0" step="0.01" placeholder="Selling price" />
            <SelectInput label="VAT treatment" options={["VAT_STD", "VAT_ZERO", "VAT_EXEMPT", "VAT_OUT_OF_SCOPE"]} defaultValue="VAT_STD" />
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-semibold text-slate-950">Opening stock, optional</h3>
          <p className="mt-1 text-sm text-slate-600">Use this when the goods are already in the shop or warehouse now.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <CheckboxInput label="Create opening stock after save" />
            <TextInput label="Opening stock quantity" type="number" min="0" step="0.01" />
            <TextInput label="Opening stock unit cost" type="number" min="0" step="0.01" />
          </div>
        </section>

        <div className="mt-6 space-y-3">
          <OptionalSection title="Packaging and units">
            <SelectInput label="Purchase unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Crate" />
            <SelectInput label="Selling unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue="Bottle" />
            <TextInput label="Units per purchase pack" type="number" min="0" step="0.01" placeholder="Example: 24" />
            <TextInput label="Pack barcode" />
            <TextInput label="Pack SKU" />
          </OptionalSection>

          <OptionalSection title="Pricing and reorder controls">
            <TextInput label="Standard cost" type="number" min="0" step="0.01" />
            <TextInput label="Minimum selling price" type="number" min="0" step="0.01" />
            <TextInput label="Reorder level" type="number" min="0" step="0.01" />
            <TextInput label="Reorder quantity" type="number" min="0" step="0.01" />
            <TextInput label="Maximum stock level" type="number" min="0" step="0.01" />
            <TextInput label="Lead time days" type="number" min="0" step="1" />
          </OptionalSection>

          <OptionalSection title="Tracking, expiry and advanced details">
            <CheckboxInput label="Track batches" />
            <CheckboxInput label="Track expiry" />
            <CheckboxInput label="Track serial numbers" />
            <CheckboxInput label="Track returnable packaging" />
            <TextInput label="Shelf life days" type="number" min="0" step="1" />
            <TextInput label="Manufacturer" />
            <TextInput label="Product code" />
            <TextInput label="SKU" />
            <TextInput label="Short name" />
            <TextInput label="Description" />
            <TextInput label="Product image URL" type="url" placeholder="https://..." />
            <TextInput label="Weight" type="number" min="0" step="0.001" />
            <TextInput label="Volume" type="number" min="0" step="0.001" />
            <SelectInput label="Product status" options={["Active", "Inactive"]} defaultValue="Active" />
          </OptionalSection>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save product</button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Fastest setup</h2>
          <ol className="mt-3 space-y-3 text-sm text-slate-700">
            <li>1. Enter product name, brand and category.</li>
            <li>2. Add selling price and VAT treatment.</li>
            <li>3. Add opening stock only if goods are already available.</li>
          </ol>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Useful for distributors</h2>
          <div className="mt-3 grid gap-2">
            {distributorQuickSetup.slice(0, 6).map((item) => (
              <span key={item} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{item}</span>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
