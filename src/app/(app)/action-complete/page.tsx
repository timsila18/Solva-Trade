import Link from "next/link";
import { CheckCircle2, Download, Home, Plus, Printer } from "lucide-react";

export default async function ActionCompletePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const moduleName = String(params.module ?? "Solva Trade");
  const processName = String(params.process ?? "Business process");
  const intent = String(params.intent ?? "Completed");
  const returnTo = String(params.returnTo ?? "/dashboard");
  const next = String(params.next ?? "Open Dashboard");
  const party = String(params.customer ?? params.company ?? params.user ?? "");
  const exportBase = `/api/exports?module=${encodeURIComponent(moduleName)}&process=${encodeURIComponent(processName)}${party ? `&party=${encodeURIComponent(party)}` : ""}`;
  const exportHref = `${exportBase}&format=csv`;
  const excelHref = `${exportBase}&format=excel`;
  const pdfHref = `${exportBase}&format=pdf`;
  const printHref = `${exportBase}&format=print`;

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <section className="rounded-lg border border-emerald-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="mt-5 text-sm font-semibold text-emerald-700">{moduleName}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{intent} successfully</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          {processName} has been captured in this workspace flow. In production, this step connects to the tenant ledger,
          audit log, approvals, exports and notification trail for the selected business.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={returnTo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 py-3 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            {next}
          </Link>
          <a href={exportHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <a href={excelHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Download className="h-4 w-4" />
            Export Excel
          </a>
          <a href={pdfHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Download className="h-4 w-4" />
            Export PDF
          </a>
          <a href={printHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Printer className="h-4 w-4" />
            Print
          </a>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
