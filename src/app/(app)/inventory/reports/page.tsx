import { inventoryReports } from "@/lib/inventory";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";

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
    name: "Product Inventory Usage Report",
    description: "Inventory Count-style reorder worksheet showing stock check date, vendor SKU, quantity in stock, reorder level, quantity above or below par and estimated order value.",
    process: "Product Inventory Usage Report",
  },
  {
    name: "Inventory Aging Report",
    description: "Stock age report showing last received date, age bucket, quantity, inventory value, risk level and recommended action for slow-moving stock.",
    process: "Inventory Aging Report",
  },
  {
    name: "Inventory Discrepancy Report",
    description: "Physical count control report comparing on-hand quantity with actual count, discrepancy status, reorder controls and approval-ready adjustment notes.",
    process: "Inventory Discrepancy Report",
  },
  {
    name: "Inventory Audit Report",
    description: "Audit extract covering item setup, vendor, location, cost, quantity, total value, reorder settings, discontinued status, VAT treatment and tracking flags.",
    process: "Inventory Audit Report",
  },
  {
    name: "Inventory Sales Report",
    description: "Monthly inventory sales view with revenue, units sold, average order value, growth percentages and gross profit from posted sales allocations.",
    process: "Inventory Sales Report",
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
      <section className="border-b border-slate-200 bg-white px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Inventory reports</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Reports and exports</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Reports use saved products, stock movements, balances, batch/expiry settings and returnable-packaging data. PDFs are presentation-ready; Excel and CSV carry the detailed records.
        </p>
      </section>

      <section className="mt-5 border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 pl-10 text-sm" placeholder="Search reports" />
          </label>
          <select className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm"><option>All branches</option></select>
          <select className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm"><option>All warehouses</option></select>
          <select className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm"><option>PDF export</option><option>Excel export</option><option>Print view</option></select>
        </div>
      </section>

      <section className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-[1.1fr_1.7fr_270px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <span>Priority report</span>
          <span>Use in the business</span>
          <span className="text-right">Export</span>
        </div>
        {featuredReports.map((report) => (
          <article key={report.name} className="grid grid-cols-[1.1fr_1.7fr_270px] items-center gap-4 border-b border-slate-200 px-4 py-4 last:border-b-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--solva-blue-700)]">Priority</p>
              <h2 className="mt-1 font-semibold text-slate-950">{report.name}</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">{report.description}</p>
            <div className="flex justify-end gap-2">
              <a href={exportHref(report.process, "print")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" />Print</a>
              <a href={exportHref(report.process, "excel")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-[var(--solva-blue-700)]"><FileSpreadsheet className="h-3.5 w-3.5" />Excel</a>
              <a href={exportHref(report.process, "pdf")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] bg-[var(--solva-blue-700)] px-3 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5" />PDF</a>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {inventoryReports.map((report) => (
          <article key={report} className="border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{report}</h2>
            <p className="mt-2 text-sm text-slate-600">Open this report from Inventory or the central Reports Centre in PDF, Excel and print-ready formats.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={exportHref(report, "pdf")} className="rounded-[6px] bg-[var(--solva-blue-700)] px-3 py-2 text-xs font-semibold text-white">PDF</a>
              <a href={exportHref(report, "excel")} className="rounded-[6px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Excel</a>
              <a href={exportHref(report, "print")} className="rounded-[6px] border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Print</a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
