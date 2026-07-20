import Link from "next/link";
import {
  pinnedReports,
  reportingHub,
  scheduledReportFrequencies,
} from "@/lib/business-intelligence-data";

const categories = Array.from(new Set(reportingHub.map((report) => report.category)));

export default function ReportsPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Reporting hub</p>
          <h1 className="mt-1 text-3xl font-semibold">All Reports</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Executive, operational, financial, inventory, sales, purchasing, treasury, accounting, tax, budget and custom-report foundations in one searchable workspace.
          </p>
        </div>
        <Link href="/dashboard" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Command centre
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Registered reports</p>
          <h2 className="mt-3 text-2xl font-semibold">{reportingHub.length}</h2>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Categories</p>
          <h2 className="mt-3 text-2xl font-semibold">{categories.length}</h2>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Pinned reports</p>
          <h2 className="mt-3 text-2xl font-semibold">{pinnedReports.length}</h2>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Scheduled foundation</p>
          <h2 className="mt-3 text-2xl font-semibold">Ready</h2>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pinned</h2>
          <div className="mt-4 grid gap-2">
            {pinnedReports.map((report) => (
              <div key={report} className="rounded-md bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950">{report}</div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Scheduled Reports</h2>
          <div className="mt-4 grid gap-2">
            {scheduledReportFrequencies.map((frequency) => (
              <div key={frequency} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                {frequency} schedule, email-ready and download-ready architecture
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Categories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{category}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Report Catalog</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          {reportingHub.map((report) => (
            <div key={`${report.category}-${report.name}`} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-[0.5fr_1fr_1fr]">
              <span className="font-semibold">{report.category}</span>
              <span>{report.name}</span>
              <span className="text-slate-600">Screen, CSV, workbook and PDF-ready foundation</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
