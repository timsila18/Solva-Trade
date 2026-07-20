import Link from "next/link";

export default function ProductsPage() {
  const filters = ["Category", "Brand", "Product type", "Stock status", "Branch", "Warehouse", "Active", "Batch tracked", "Expiry tracked"];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Product catalogue</p>
          <h1 className="mt-1 text-3xl font-semibold">Products</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Manage stock items, services, returnable packaging, variants, SKUs, barcodes, units, reorder levels and inventory tracking settings.
          </p>
        </div>
        <Link href="/inventory/products/new" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Add product
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search by product, SKU, barcode, category or brand" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filters.map((filter) => (
            <select key={filter} className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
              <option value="all">{filter}: All</option>
            </select>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-8 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>Product</span>
          <span>SKU</span>
          <span>Barcode</span>
          <span>Category</span>
          <span>Brand</span>
          <span>Stock Available</span>
          <span>Value</span>
          <span>Status</span>
        </div>
        <div className="px-4 py-12 text-center">
          <h2 className="text-lg font-semibold">No products yet</h2>
          <p className="mt-2 text-sm text-slate-600">Create your first product or import a catalogue template. No sample stock values are invented.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/inventory/products/new" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Create product</Link>
            <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Download import template</button>
          </div>
        </div>
      </section>
    </div>
  );
}
