import { distributorQuickSetup, productSetupSections, productTypes } from "@/lib/inventory-data";

export default function NewProductPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Product setup</p>
      <h1 className="mt-1 text-3xl font-semibold">Create product or service</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Start simple with name, type, category and unit. Advanced distributor, batch, expiry, serial and reorder settings remain optional.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr_320px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          {productSetupSections.map((section, index) => (
            <div key={section} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-xs font-semibold text-emerald-800">{index + 1}</span>
              <span className="text-sm font-medium">{section}</span>
            </div>
          ))}
        </aside>

        <form className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Basic product details</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {["Product name", "Short name", "Product code", "SKU", "Barcode", "Manufacturer"].map((field) => (
              <label key={field} className="text-sm font-medium">
                {field}
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={field} />
              </label>
            ))}
            <label className="text-sm font-medium">
              Product type
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="Stock Item">
                {productTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Base stock unit
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="Bottle">
                {["Piece", "Bottle", "Crate", "Carton", "Kilogram", "Litre", "Service"].map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Selling price placeholder
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" />
            </label>
            <label className="text-sm font-medium">
              Reorder level
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min="0" step="0.01" />
            </label>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {["Track inventory", "Track batches", "Track expiry", "Track serial numbers", "Track returnable packaging", "Create opening stock after save"].map((field) => (
              <label key={field} className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
                <input type="checkbox" defaultChecked={field === "Track inventory"} />
                {field}
              </label>
            ))}
          </div>

          <button className="mt-6 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Save product</button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Distributor quick setup</h2>
            <div className="mt-3 space-y-2">
              {distributorQuickSetup.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" />
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
    </div>
  );
}
