import { completeProcessAction } from "@/app/(app)/actions";
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

function Checkbox({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  const key = keyFor(label);
  return (
    <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
      <input type="hidden" name={`label_${key}`} value={label} />
      <input name={`field_${key}`} type="checkbox" value="yes" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export default function NewSupplierPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Supplier setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create supplier</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Save the supplier once, then use them in purchases, GRNs, source-cost tracking, supplier balances and purchasing reports.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Suppliers" />
          <input type="hidden" name="process" value="New Supplier" />
          <input type="hidden" name="document" value="Supplier Profile" />
          <input type="hidden" name="intent" value="Supplier saved" />
          <input type="hidden" name="returnTo" value="/suppliers/new" />
          <input type="hidden" name="next" value="Add another supplier" />

          <div className="grid gap-8">
            <section>
              <h2 className="text-lg font-semibold">1. Supplier identity</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Legal name" required />
                <Field label="Trading name" />
                <Field label="Supplier code" placeholder="Leave blank to auto-generate" />
                <Field label="KRA PIN" />
                <Field label="Registration number" />
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
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Contact and location</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Primary contact person" />
                <Field label="Contact title" />
                <Field label="Primary phone" type="tel" />
                <Field label="Alternative phone" type="tel" />
                <Field label="Email" type="email" />
                <Field label="Website" type="url" placeholder="https://..." />
                <Field label="Physical address" />
                <Field label="Town" />
                <Field label="County" />
                <Field label="Country" placeholder="Kenya" />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Terms and source tracking</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Payment terms
                  <input type="hidden" name="label_payment_terms" value="Payment terms" />
                  <select
                    name="field_payment_terms"
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    defaultValue="Net 30"
                  >
                    {["Cash", "Net 7", "Net 14", "Net 30", "Net 60", "Custom"].map((term) => (
                      <option key={term}>{term}</option>
                    ))}
                  </select>
                </label>
                <Field label="Credit limit" type="number" min="0" step="0.01" />
                <Field label="Opening balance" type="number" min="0" step="0.01" />
                <Field label="Supplier category" placeholder="Direct supplier, local market, spot supplier..." />
                <Field label="Main products" placeholder="Coke, Aquamist, Predator..." />
                <Field label="Delivery instructions" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Checkbox label="VAT registered" />
                <Checkbox label="Preferred supplier" defaultChecked />
                <Checkbox label="Requires purchase order" defaultChecked />
                <Checkbox label="Bank details verified" />
                <Checkbox label="Submit for approval" />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Notes</h2>
              <input type="hidden" name="label_notes" value="Notes" />
              <textarea
                name="field_notes"
                rows={4}
                placeholder="Anything the buyer, storekeeper or accountant should know about this supplier."
                className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </section>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save supplier</button>
            <a href="/suppliers" className="rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">
              View suppliers
            </a>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-cyan-100 bg-cyan-50 p-5">
            <h2 className="font-semibold text-slate-950">Source-cost reporting</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Mark suppliers as direct, local market or spot suppliers in the category/notes. GRNs will capture the actual source and cost, then sales profit reports can separate those margins.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">What happens after save</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <p className="rounded-md bg-slate-100 px-3 py-3">Supplier becomes selectable in Purchase Orders and Goods Received Notes.</p>
              <p className="rounded-md bg-slate-100 px-3 py-3">Opening balance posts to supplier balances when entered.</p>
              <p className="rounded-md bg-slate-100 px-3 py-3">Supplier profile is immediately downloadable from the completion screen.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
