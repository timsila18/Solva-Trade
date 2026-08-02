import { completeProcessAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
import { supplierTypes } from "@/lib/purchasing-data";

function keyFor(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function Field({
  label,
  type = "text",
  required = false,
  placeholder,
  step,
  min,
}: {
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  const key = keyFor(label);
  return (
    <label className="text-sm font-medium">
      {label}
      <input type="hidden" name={`label_${key}`} value={label} />
      <input
        name={`field_${key}`}
        type={type}
        required={required}
        placeholder={placeholder ?? label}
        step={step}
        min={min}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
      />
    </label>
  );
}

function safeReturnTo(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] : value;
  return typeof resolved === "string" && resolved.startsWith("/") && !resolved.startsWith("//") ? resolved : undefined;
}

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo) ?? "/suppliers/new";
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Supplier setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create supplier</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Save the few details needed to receive stock, create GRNs and track supplier balances.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <PersistedForm action={completeProcessAction} draftKey="solva-trade:supplier-create" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="module" value="Suppliers" />
          <input type="hidden" name="process" value="New Supplier" />
          <input type="hidden" name="document" value="Supplier Profile" />
          <input type="hidden" name="intent" value="Supplier saved" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="next" value="Add another supplier" />
          <input type="hidden" name="label_preferred_supplier" value="Preferred supplier" />
          <input type="hidden" name="field_preferred_supplier" value="yes" />

          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <Field label="Legal name" required placeholder="Supplier business name" />
              <Field label="Trading name" placeholder="Optional display name" />
              <Field label="Primary phone" type="tel" required placeholder="Phone or WhatsApp number" />
              <Field label="KRA PIN" placeholder="Optional" />
              <label className="text-sm font-medium">
                Supplier type
                <input type="hidden" name="label_supplier_type" value="Supplier type" />
                <select
                  name="field_supplier_type"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  defaultValue="Wholesaler"
                >
                  {supplierTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Payment terms
                <input type="hidden" name="label_payment_terms" value="Payment terms" />
                <select
                  name="field_payment_terms"
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  defaultValue="Cash"
                >
                  {["Cash", "Net 7", "Net 14", "Net 30", "Net 60"].map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </label>
              <Field label="Supplier category" placeholder="Direct supplier, local market, spot supplier" />
              <Field label="Opening balance" type="number" min="0" step="0.01" placeholder="0.00" />
            </section>

            <section>
              <input type="hidden" name="label_notes" value="Notes" />
              <textarea
                name="field_notes"
                rows={3}
                placeholder="Optional notes: main goods supplied, delivery habit, contact person, or special buying terms."
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </section>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save supplier</button>
            <a href="/suppliers" className="rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">
              View suppliers
            </a>
          </div>
        </PersistedForm>

        <aside className="space-y-4">
          <section className="rounded-lg border border-cyan-100 bg-cyan-50 p-5">
            <h2 className="font-semibold text-slate-950">What matters most</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Name, phone, supplier type and payment terms are enough to start. You can add more supplier details later.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">What happens after save</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <p className="rounded-md bg-slate-100 px-3 py-3">Supplier becomes selectable in Purchase Orders and Goods Received Notes.</p>
              <p className="rounded-md bg-slate-100 px-3 py-3">Opening balance posts only when you enter one.</p>
              <p className="rounded-md bg-slate-100 px-3 py-3">Source-cost reports still separate direct, local and spot suppliers.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
