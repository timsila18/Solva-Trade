import { inventoryReports } from "@/lib/inventory";

export default function InventoryReportsPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Inventory reports</p>
      <h1 className="mt-1 text-3xl font-semibold">Reports and exports</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Reports use real product, movement, balance, batch, serial and returnable-packaging data only.
      </p>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search reports" />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option>All branches</option></select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option>All warehouses</option></select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option>CSV export</option><option>PDF export</option><option>Print view</option></select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventoryReports.map((report) => (
          <article key={report} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{report}</h2>
            <p className="mt-2 text-sm text-slate-600">Filters, sorting, pagination, print and export are prepared for ledger-backed data.</p>
          </article>
        ))}
      </section>
    </div>
  );
}
