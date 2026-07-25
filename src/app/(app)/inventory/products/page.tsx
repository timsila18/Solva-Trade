import Link from "next/link";
import { Download, PackagePlus, Search } from "lucide-react";

export default function ProductsPage() {
  const filters = ["Category", "Brand", "Product type", "Stock status", "Branch", "Warehouse", "Active", "Batch tracked", "Expiry tracked"];

  return (
    <div className="pb-20">
      <div className="border-b border-slate-200 bg-white px-5 py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Inventory control</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Products</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage stock items, services, returnable packaging, variants, SKUs, barcodes, units, reorder levels and inventory tracking settings.
          </p>
        </div>
        <Link href="/inventory/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-[var(--solva-blue-700)] px-4 py-2.5 text-sm font-semibold text-white">
          <PackagePlus className="h-4 w-4" />
          Add product
        </Link>
        </div>
      </div>

      <section className="mt-5 border border-slate-200 bg-white p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2 pl-10 text-sm" placeholder="Search by product, SKU, barcode, category or brand" />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filters.map((filter) => (
            <select key={filter} className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
              <option value="all">{filter}: All</option>
            </select>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1fr_0.9fr_0.9fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Add Coke 500ml, set the selling unit, VAT treatment, reorder level and source-cost controls. Stock value will only appear after receiving stock.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/inventory/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-[var(--solva-blue-700)] px-4 py-2 text-sm font-semibold text-white">
              <PackagePlus className="h-4 w-4" />
              Create product
            </Link>
            <Link href="/api/exports?module=Inventory&process=Products%20import%20template&format=excel" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 px-4 py-2 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Import template
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
