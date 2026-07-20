import Link from "next/link";
import { notFound } from "next/navigation";
import {
  etimsLifecycle,
  taxComplianceNotes,
  taxProfileChecklist,
  taxSummary,
  taxWorkflows,
  vatCodes,
} from "@/lib/tax-compliance-data";
import { taxReports } from "@/lib/tax-compliance";

const detailBySlug: Record<string, { title: string; focus: string; actions: string[] }> = {
  "setup-profile": {
    title: "Business Tax Profile",
    focus: "KRA PIN, VAT status, tax obligations, taxpayer identity, filing cadence and verification evidence.",
    actions: ["Capture or verify tax identity", "Attach registration evidence", "Assign tax filing owner"],
  },
  "branch-outlets": {
    title: "Branch and Outlet Setup",
    focus: "Branch-specific tax outlet names, external identifiers, invoice series and device references.",
    actions: ["Map branch outlet references", "Set submission mode", "Assign responsible user"],
  },
  "tax-rules": {
    title: "Tax Rules",
    focus: "Effective-dated statutory and custom tax rules with overlap prevention and external tax codes.",
    actions: ["Create effective-dated rule", "Review overlapping dates", "Approve rule changes"],
  },
  "vat-codes": {
    title: "VAT Codes",
    focus: "VAT treatment codes, recoverability, accounts, eTIMS categories and evidence requirements.",
    actions: ["Review standard VAT code", "Configure input recoverability", "Map VAT control accounts"],
  },
  mappings: {
    title: "Product Tax Mappings",
    focus: "Resolution precedence from line override to counterparty, product, category and business default.",
    actions: ["Review unmapped products", "Set category defaults", "Validate branch overrides"],
  },
  customers: {
    title: "Customer Tax Profiles",
    focus: "Buyer PINs, exemptions, export status, withholding-agent flags and eTIMS buyer identifiers.",
    actions: ["Verify buyer PINs", "Capture exemption references", "Mark export customers"],
  },
  suppliers: {
    title: "Supplier Tax Profiles",
    focus: "Supplier PINs, VAT status, withholding rules and default purchase VAT treatment.",
    actions: ["Verify supplier PINs", "Set withholding applicability", "Review purchase VAT defaults"],
  },
  "vat-calculator": {
    title: "VAT Calculator",
    focus: "Exclusive and inclusive VAT, discounts, rounding, mixed-tax documents and credit-note boundaries.",
    actions: ["Run document calculation", "Review line overrides", "Compare gross and tax totals"],
  },
  "sales-documents": {
    title: "Sales Tax Documents",
    focus: "Sales invoices, receipts, credit notes and debit notes with tax snapshots and source references.",
    actions: ["Review posted invoices", "Queue external documents", "Check credit-note links"],
  },
  "purchase-documents": {
    title: "Purchase Tax Documents",
    focus: "Supplier tax-document verification and recoverable input VAT eligibility.",
    actions: ["Verify supplier document", "Mark input VAT eligibility", "Attach supporting evidence"],
  },
  "credit-debit-notes": {
    title: "Credit and Debit Notes",
    focus: "Original-document linkage, remaining eligible credit checks and approval evidence.",
    actions: ["Link original document", "Validate remaining credit value", "Capture approval"],
  },
  "etims-config": {
    title: "eTIMS Configuration",
    focus: "Provider-neutral adapter settings, branch identifiers, environment and credential references.",
    actions: ["Set provider mode", "Record credential reference", "Review callback settings"],
  },
  "etims-queue": {
    title: "eTIMS Queue",
    focus: "Canonical payloads, idempotency keys, retry safety, provider responses and manual review.",
    actions: ["Review pending queue", "Retry safe failures", "Resolve duplicate warnings"],
  },
  "external-registry": {
    title: "External Document Registry",
    focus: "External receipt numbers, control-unit references, QR data, signatures and response hashes.",
    actions: ["Record manual reference", "Match provider response", "Lock accepted records"],
  },
  "vat-ledgers": {
    title: "VAT Ledgers",
    focus: "Posted payable, recoverable, non-recoverable, payment and refund entries by branch and period.",
    actions: ["Review output VAT", "Review input VAT", "Trace to journal entry"],
  },
  "vat-return": {
    title: "VAT Return",
    focus: "VAT return preparation, filing references, payment references and reconciliation differences.",
    actions: ["Prepare return", "Reconcile tax ledger", "Record filing reference"],
  },
  withholding: {
    title: "Withholding Tax",
    focus: "Withholding calculations, certificates, supplier schedules and filing preparation.",
    actions: ["Calculate withholding", "Issue certificate", "Prepare return schedule"],
  },
  "withholding-vat": {
    title: "Withholding VAT",
    focus: "Withholding VAT treatment, payment linkage and separate statutory schedules.",
    actions: ["Review applicable suppliers", "Calculate withholding VAT", "Prepare schedule"],
  },
  "turnover-excise": {
    title: "Turnover, Excise and Levies",
    focus: "Foundations for turnover tax, excise duty, import declaration fees and other Kenyan levies.",
    actions: ["Configure obligation", "Map taxable base", "Review levy report"],
  },
  calendar: {
    title: "Compliance Calendar",
    focus: "Filing dates, payment dates, reminders, responsible users and completion evidence.",
    actions: ["Create obligation", "Set reminder", "Mark completion evidence"],
  },
  periods: {
    title: "Tax Periods",
    focus: "Open, soft close, close and controlled reopening states for tax documents and ledgers.",
    actions: ["Open next period", "Run close checks", "Record reopening reason"],
  },
  evidence: {
    title: "Audit Evidence",
    focus: "Source documents, payload hashes, filings, payments, reconciliations and approval records.",
    actions: ["Attach evidence", "Link source record", "Review retention status"],
  },
  imports: {
    title: "Imports",
    focus: "Staged tax imports, row validation results, duplicate detection and committed-batch evidence.",
    actions: ["Upload import batch", "Resolve invalid rows", "Commit reviewed data"],
  },
  reports: {
    title: "Tax Reports",
    focus: "Statutory, reconciliation, diagnostic and audit reports for VAT, eTIMS and withholding workflows.",
    actions: ["Run report", "Export tax data", "Save report snapshot"],
  },
  "integration-health": {
    title: "Integration Health",
    focus: "Credential references, queue depth, failures, oldest pending document and adapter status.",
    actions: ["Review failed queue", "Check oldest pending document", "Update adapter reference"],
  },
};

export default async function TaxWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const detail = detailBySlug[workflow];
  if (!detail) notFound();

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link href="/tax" className="text-sm font-semibold text-emerald-700">
            Tax compliance
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">{detail.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{detail.focus}</p>
        </div>
        <Link href="/tax/reports" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
          Tax reports
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Profile status", taxSummary.profileStatus],
          ["eTIMS status", taxSummary.etimsStatus],
          ["Current VAT balance", taxSummary.currentVatBalance],
          ["Reconciliation", taxSummary.reconciliationStatus],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {detail.actions.map((action) => (
          <article key={action} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{action}</h2>
            <p className="mt-3 text-sm text-slate-600">Ready for real business records, approval checks and audit evidence.</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">VAT treatment register</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            {vatCodes.map(([code, name, rate, scope, note]) => (
              <div key={code} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-5">
                <span className="font-semibold">{code}</span>
                <span>{name}</span>
                <span>{rate}</span>
                <span className="text-slate-600">{scope}</span>
                <span className="text-slate-600">{note}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">eTIMS lifecycle</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {etimsLifecycle.map((status) => (
              <span key={status} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                {status.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <div className="mt-5 grid gap-3">
            {taxComplianceNotes.map((note) => (
              <p key={note} className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                {note}
              </p>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Registered tax reports</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {taxReports.map((report) => (
            <span key={report} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {report}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Profile setup checks</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {taxProfileChecklist.map((item) => (
            <div key={item} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Link href="/tax" className="text-sm font-semibold text-emerald-700">
          Back to tax workflows
        </Link>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {taxWorkflows.slice(0, 10).map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm hover:border-emerald-300">
              {item.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
