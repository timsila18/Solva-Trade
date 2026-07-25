import { inventoryReports } from "@/lib/inventory";

const featuredReports = [
  {
    name: "Product Master Report",
    description: "Every product entered into Solva Trade with brand, category, SKU, barcode, units, pack conversion, VAT treatment, cost, selling price, stock value and reorder status.",
    process: "Product Master Report",
  },
  {
    name: "Inventory Valuation Report",
    description: "Stock quantity, average cost and total value by product, warehouse and status.",
    process: "Inventory Valuation Report",
  },
  {
    name: "Reorder List",
    description: "Products that need buying attention based on available stock, reorder level, lead time and reorder quantity.",
    process: "Reorder List",
  },
];

function exportHref(process: string, format: "pdf" | "excel" | "csv" | "print") {
  return `/api/exports?module=Inventory&process=${encodeURIComponent(process)}&format=${format}`;
}

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

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {featuredReports.map((report) => (
          <article key={report.name} className="rounded-lg border border-cyan-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Priority inventory report</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{report.name}</h2>
            <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{report.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={exportHref(report.process, "print")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">Preview</a>
              <a href={exportHref(report.process, "pdf")} className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white">PDF</a>
              <a href={exportHref(report.process, "excel")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-[var(--solva-blue-700)]">Excel</a>
              <a href={exportHref(report.process, "csv")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">CSV</a>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventoryReports.map((report) => (
          <article key={report} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{report}</h2>
            <p className="mt-2 text-sm text-slate-600">Open this report from Inventory or the central Reports Centre in PDF, Excel and print-ready formats.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={exportHref(report, "pdf")} className="rounded-md bg-[var(--solva-blue-700)] px-3 py-2 text-xs font-semibold text-white">PDF</a>
              <a href={exportHref(report, "excel")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Excel</a>
              <a href={exportHref(report, "print")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Print</a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
