"use client";

import { completeProcessAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
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
  defaultValue,
}: {
  label: string;
  type?: "text" | "number" | "date" | "url";
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
  defaultValue?: string | number | null;
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
        defaultValue={defaultValue ?? undefined}
      />
    </label>
  );
}

function SelectInput({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string | null }) {
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
      <div className="mt-4 space-y-5">{children}</div>
    </details>
  );
}

export type ProductSetupDefaults = Partial<Record<
  | "id"
  | "product_name"
  | "brand"
  | "category"
  | "product_type"
  | "base_stock_unit"
  | "barcode"
  | "selling_price_placeholder"
  | "vat_treatment"
  | "purchase_unit"
  | "selling_unit"
  | "units_per_purchase_pack"
  | "pack_barcode"
  | "pack_sku"
  | "standard_cost"
  | "minimum_selling_price"
  | "reorder_level"
  | "reorder_quantity"
  | "maximum_stock_level"
  | "lead_time_days"
  | "track_batches"
  | "track_expiry"
  | "track_serial_numbers"
  | "track_returnable_packaging"
  | "shelf_life_days"
  | "manufacturer"
  | "product_code"
  | "sku"
  | "short_name"
  | "description"
  | "product_image_url"
  | "weight"
  | "volume"
  | "product_status",
  string | number | boolean | null
>>;

function value(defaults: ProductSetupDefaults, key: keyof ProductSetupDefaults) {
  const item = defaults[key];
  if (typeof item === "boolean") return item ? "yes" : "";
  return item ?? "";
}

function checked(defaults: ProductSetupDefaults, key: keyof ProductSetupDefaults) {
  return defaults[key] === true || defaults[key] === "yes";
}

export function ProductSetupForm({
  mode = "create",
  defaults = {},
  returnTo,
}: {
  mode?: "create" | "edit";
  defaults?: ProductSetupDefaults;
  returnTo?: string;
}) {
  const isEdit = mode === "edit";
  const resolvedReturnTo = returnTo || (isEdit ? `/inventory/products/${defaults.id}/edit` : "/inventory/products/new");
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
      <PersistedForm action={completeProcessAction} draftKey={isEdit ? `solva-trade:product-edit:${defaults.id}` : "solva-trade:product-create"} className="rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Inventory" />
        <input type="hidden" name="process" value={isEdit ? "Edit Product" : "New Product"} />
        <input type="hidden" name="intent" value={isEdit ? "Product updated" : "Product saved"} />
        <input type="hidden" name="returnTo" value={resolvedReturnTo} />
        <input type="hidden" name="next" value={isEdit ? "Back to products" : "Add another product"} />
        {isEdit ? <input type="hidden" name="recordId" value={String(defaults.id ?? "")} /> : null}
        <input type="hidden" name="field_track_inventory" value="yes" />
        <input type="hidden" name="label_track_inventory" value="Track inventory" />

        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Quick product setup</p>
            <h2 className="mt-1 text-xl font-semibold">{isEdit ? "Edit product details" : "Add the product and start selling"}</h2>
            <p className="mt-1 text-sm text-slate-600">{isEdit ? "Update the details that affect sales, purchase receipts, stock alerts and reports." : "Fill the essentials. Open advanced details only when the item needs them."}</p>
          </div>
          <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">{isEdit ? "Update product" : "Save product"}</button>
        </div>

        <section className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Essentials</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <TextInput label="Product name" required placeholder="Example: Predator 500ml" defaultValue={value(defaults, "product_name")} />
            <TextInput label="Brand" placeholder="Example: Coca-Cola, Aquamist, Predator" defaultValue={value(defaults, "brand")} />
            <TextInput label="Category" placeholder="Example: Soft drinks, Water, Energy drinks" defaultValue={value(defaults, "category")} />
            <SelectInput label="Product type" options={productTypes} defaultValue={String(value(defaults, "product_type") || "Stock Item")} />
            <SelectInput label="Base stock unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue={String(value(defaults, "base_stock_unit") || "Bottle")} />
            <TextInput label="Barcode" defaultValue={value(defaults, "barcode")} />
            <TextInput label="Selling price placeholder" type="number" min="0" step="0.01" placeholder="Selling price" defaultValue={value(defaults, "selling_price_placeholder")} />
            <SelectInput label="VAT treatment" options={["VAT_STD", "VAT_ZERO", "VAT_EXEMPT", "VAT_OUT_OF_SCOPE"]} defaultValue={String(value(defaults, "vat_treatment") || "VAT_STD")} />
          </div>
        </section>

        {!isEdit ? <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-semibold text-slate-950">Opening stock, optional</h3>
          <p className="mt-1 text-sm text-slate-600">Use this when the goods are already in the shop or warehouse now.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <CheckboxInput label="Create opening stock after save" />
            <TextInput label="Opening stock quantity" type="number" min="0" step="0.01" />
            <TextInput label="Opening stock unit cost" type="number" min="0" step="0.01" />
          </div>
        </section> : null}

        <div className="mt-6">
          <OptionalSection title="More details only when needed">
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Packaging</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <SelectInput label="Purchase unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue={String(value(defaults, "purchase_unit") || value(defaults, "base_stock_unit") || "Case")} />
                <SelectInput label="Selling unit" options={["Piece", "Bottle", "Can", "Crate", "Case", "Carton", "Kilogram", "Litre", "Service", "Other"]} defaultValue={String(value(defaults, "selling_unit") || value(defaults, "base_stock_unit") || "Case")} />
                <TextInput label="Units per purchase pack" type="number" min="0" step="0.01" placeholder="Example: 24" defaultValue={value(defaults, "units_per_purchase_pack")} />
                <TextInput label="Pack SKU" defaultValue={value(defaults, "pack_sku")} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Cost and reorder</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <TextInput label="Standard cost" type="number" min="0" step="0.01" defaultValue={value(defaults, "standard_cost")} />
                <TextInput label="Minimum selling price" type="number" min="0" step="0.01" defaultValue={value(defaults, "minimum_selling_price")} />
                <TextInput label="Reorder level" type="number" min="0" step="0.01" defaultValue={value(defaults, "reorder_level")} />
                <TextInput label="Reorder quantity" type="number" min="0" step="0.01" defaultValue={value(defaults, "reorder_quantity")} />
                <TextInput label="Maximum stock level" type="number" min="0" step="0.01" defaultValue={value(defaults, "maximum_stock_level")} />
                <TextInput label="Lead time days" type="number" min="0" step="1" defaultValue={value(defaults, "lead_time_days")} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tracking and reference</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <CheckboxInput label="Track batches" defaultChecked={checked(defaults, "track_batches")} />
                <CheckboxInput label="Track expiry" defaultChecked={checked(defaults, "track_expiry")} />
                <CheckboxInput label="Track serial numbers" defaultChecked={checked(defaults, "track_serial_numbers")} />
                <CheckboxInput label="Track returnable packaging" defaultChecked={checked(defaults, "track_returnable_packaging")} />
                <TextInput label="Shelf life days" type="number" min="0" step="1" defaultValue={value(defaults, "shelf_life_days")} />
                <TextInput label="Manufacturer" defaultValue={value(defaults, "manufacturer")} />
                <TextInput label="Product code" defaultValue={value(defaults, "product_code")} />
                <TextInput label="SKU" defaultValue={value(defaults, "sku")} />
                <TextInput label="Short name" defaultValue={value(defaults, "short_name")} />
                <TextInput label="Description" defaultValue={value(defaults, "description")} />
                <TextInput label="Product image URL" type="url" placeholder="https://..." defaultValue={value(defaults, "product_image_url")} />
                <TextInput label="Weight" type="number" min="0" step="0.001" defaultValue={value(defaults, "weight")} />
                <TextInput label="Volume" type="number" min="0" step="0.001" defaultValue={value(defaults, "volume")} />
                <SelectInput label="Product status" options={["Active", "Inactive"]} defaultValue={String(value(defaults, "product_status") || "Active")} />
              </div>
            </section>
          </OptionalSection>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">{isEdit ? "Update product" : "Save product"}</button>
        </div>
      </PersistedForm>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Fastest setup</h2>
          <ol className="mt-3 space-y-3 text-sm text-slate-700">
            <li>1. Enter product name, category and unit.</li>
            <li>2. Add selling price and VAT treatment.</li>
            <li>3. Save. Use More details only for pack, reorder, batch or expiry items.</li>
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
