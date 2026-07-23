import Link from "next/link";
import {
  taxComplianceNotes,
  taxProfileChecklist,
  taxStatusCards,
  taxSummary,
  taxWorkflows,
} from "@/lib/tax-compliance-data";

export default function TaxCompliancePage() {
  const cards = [
    ["Business tax profile", taxSummary.profileStatus],
    ["KRA PIN", taxSummary.kraPin],
    ["VAT registration", taxSummary.vatRegistration],
    ["eTIMS integration", taxSummary.etimsStatus],
    ["Output VAT", taxSummary.outputVat],
    ["Recoverable input VAT", taxSummary.recoverableInputVat],
    ["Current VAT balance", taxSummary.currentVatBalance],
    ["Audit evidence", taxSummary.auditEvidenceItems],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Kenyan tax compliance</p>
          <h1 className="mt-1 text-3xl font-semibold">Tax, VAT and eTIMS Control Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Configure tax obligations, calculate VAT, track eTIMS submissions, prepare returns and preserve statutory audit evidence from posted accounting records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tax/vat-return" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            VAT return
          </Link>
          <Link href="/tax/etims-queue" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            eTIMS queue
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {taxStatusCards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-800">{label}</p>
            <p className="mt-3 text-xl font-semibold text-emerald-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Integration status</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">eTIMS/KRA live API is not connected yet</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              Solva Trade can calculate VAT from configured product/customer tax treatment, prepare internal tax schedules, and export review-ready documents.
              Direct eTIMS submission still needs a certified provider/device setup, credential storage, test validation and production approval before it can be switched on.
            </p>
          </div>
          <Link href="/reports" className="rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
            Download tax reports
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["Ready now", "VAT treatment, tax calculations, sales/purchase schedules and audit-friendly exports."],
            ["Manual control", "Record external invoice or eTIMS references after submission through the approved portal/device."],
            ["Not live yet", "No automatic KRA/eTIMS API submission will run until certified credentials and callbacks are configured."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-md border border-amber-200 bg-white p-4">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {taxWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Profile checklist</h2>
          <div className="mt-4 grid gap-3">
            {taxProfileChecklist.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3">
                <span className="text-sm font-medium">{item}</span>
                <span className="text-sm text-slate-500">Action needed</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Compliance notes</h2>
          <div className="mt-4 grid gap-3">
            {taxComplianceNotes.map((note) => (
              <p key={note} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">
                {note}
              </p>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
