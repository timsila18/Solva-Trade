import { supplierSetupSections, supplierTypes } from "@/lib/purchasing-data";

export default function NewSupplierPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Supplier setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create supplier</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Capture identity, tax, contact, payment and product-price details before routing the supplier through approval.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr_320px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          {supplierSetupSections.map((section, index) => (
            <div key={section} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-xs font-semibold text-emerald-800">{index + 1}</span>
              <span className="text-sm font-medium">{section}</span>
            </div>
          ))}
        </aside>

        <form className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Supplier identity</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {["Legal name", "Trading name", "Supplier code", "KRA PIN", "Registration number", "Primary phone", "Email", "Website"].map((field) => (
              <label key={field} className="text-sm font-medium">
                {field}
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={field} />
              </label>
            ))}
            <label className="text-sm font-medium">
              Supplier type
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="Distributor">
                {supplierTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Payment terms
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="Net 30">
                {["Cash", "Net 7", "Net 14", "Net 30", "Net 60", "Custom"].map((term) => (
                  <option key={term}>{term}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Credit limit
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" />
            </label>
            <label className="text-sm font-medium">
              Opening balance
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" step="0.01" />
            </label>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {["VAT registered", "Preferred supplier", "Requires purchase order", "Bank details verified", "Attach compliance document", "Submit for approval"].map((field) => (
              <label key={field} className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
                <input type="checkbox" defaultChecked={field === "Requires purchase order"} />
                {field}
              </label>
            ))}
          </div>

          <button className="mt-6 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save supplier</button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Approval controls</h2>
            <p className="mt-2 text-sm text-slate-600">
              Suppliers with payment terms, credit limits, bank changes or missing compliance documents can be routed to owner or manager approval.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">KRA PIN validation</h2>
            <p className="mt-2 text-sm text-slate-600">Accepted format follows the Kenyan PIN pattern, such as A123456789B.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
