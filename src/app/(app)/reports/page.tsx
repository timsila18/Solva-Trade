import { CalendarClock, FileText, Mail, Printer, Send } from "lucide-react";
import { MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { documentCatalog, documentCategories, type BusinessDocument } from "@/lib/document-catalog";
import {
  pinnedReports,
  reportingHub,
  scheduledReportFrequencies,
} from "@/lib/business-intelligence-data";

const categories = documentCategories;
const standoutDocuments = documentCatalog.filter((document) => document.standout);

const ownerQuestions = [
  { title: "How is the business doing?", href: "/insights/owner", description: "Revenue, cash, profit, risks and the next actions an owner should care about." },
  { title: "Who owes me money?", href: "/sales/debtor-ageing", description: "Customer balances, late payments and follow-up priorities in one place." },
  { title: "What stock needs attention?", href: "/inventory/reports", description: "Low stock, expiry risk, valuation and movement reports." },
  { title: "What tax work is due?", href: "/tax", description: "VAT, eTIMS, withholding and filing readiness." },
];

const fastDownloadPairs = [
  ["Sales", "Sales Receipt"],
  ["Sales", "Tax Invoice"],
  ["Purchasing", "Goods Received Note (GRN)"],
  ["Sales", "Daily Sales Report"],
  ["Finance", "Cashbook"],
  ["Finance", "Payment Voucher"],
  ["Tax", "VAT Report"],
  ["Customers", "Customer Aging Report"],
  ["Inventory", "Inventory Valuation Report"],
  ["Executive", "Business Health Report"],
  ["Executive", "Profit Leakage Report"],
  ["Executive", "Business Action Plan"],
] as const;

const fastDownloadDocuments = fastDownloadPairs
  .map(([category, name]) => documentCatalog.find((document) => document.category === category && document.name === name))
  .filter((document): document is BusinessDocument => Boolean(document));

function exportHref(document: BusinessDocument, format: "pdf" | "excel" | "print") {
  return `/api/exports?module=${encodeURIComponent(document.category)}&process=${encodeURIComponent(document.name)}&format=${format}`;
}

export default function ReportsPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Reports"
        title="Ask a business question. Get a clear answer."
        description="Reports are organised around what owners need to know, with export-ready detail available when finance teams need it."
        primaryAction={{ label: "Generate Report", href: "/reports", icon: FileText }}
        secondaryAction={{ label: "Back to Dashboard", href: "/dashboard" }}
        insight="I will explain reports in plain language first, then let power users open the accounting detail behind the numbers."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Documents available" value={documentCatalog.length.toString()} story="PDF, Excel and print-ready business documents." />
        <MetricCard label="Report categories" value={categories.length.toString()} story="Owner, sales, stock, cash, finance and tax views." />
        <MetricCard label="Killer documents" value={standoutDocuments.length.toString()} story="Insight-led reports that explain what to do next." />
        <MetricCard label="Scheduled reports" value="Ready" story="Email-ready and download-ready foundation." tone="good" />
      </section>

      <section className="mt-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Fast document downloads</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">Preview, download or print the documents used every day.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Each export uses Solva Trade branding, tenant details, document context, generation date and a faint watermark.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fastDownloadDocuments.map((document) => (
            <article key={`${document.category}-${document.name}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{document.category}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{document.name}</h3>
                </div>
                {document.standout ? (
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Insight</span>
                ) : null}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{document.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={exportHref(document, "print")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
                  Preview
                </a>
                <a href={exportHref(document, "pdf")} className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white shadow-sm">
                  Download
                </a>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a href={exportHref(document, "excel")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-[var(--solva-blue-700)]">
                  Excel
                </a>
                <a href={exportHref(document, "print")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                  Print
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ownerQuestions.map((question) => (
          <PlainCard key={question.href} href={question.href} title={question.title} description={question.description} action="Answer this" />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Pinned for owners</h2>
          <div className="mt-4 grid gap-2">
            {pinnedReports.map((report) => (
              <div key={report} className="rounded-md bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-950">{report}</div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Send automatically</h2>
          <div className="mt-4 grid gap-2">
            {scheduledReportFrequencies.map((frequency) => (
              <div key={frequency} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                {frequency} report schedule
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Document actions</h2>
          <div className="mt-4 grid gap-2">
            {[
              ["Email", Mail],
              ["Share", Send],
              ["Schedule", CalendarClock],
              ["Print", Printer],
            ].map(([label, Icon]) => (
              <button key={String(label)} className="inline-flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
                <Icon className="h-4 w-4 text-[var(--solva-blue-700)]" />
                {String(label)} selected document
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-cyan-100 bg-cyan-50/70 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Killer documents</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These reports do more than list records. They explain business health, cash recovery, profit leakage, stock opportunities and next actions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {standoutDocuments.map((document) => {
            return (
              <article key={document.name} className="rounded-lg border border-cyan-100 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-slate-950">{document.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{document.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={exportHref(document, "pdf")} className="rounded-md bg-[var(--solva-blue-700)] px-3 py-2 text-xs font-semibold text-white">PDF</a>
                  <a href={exportHref(document, "excel")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Excel</a>
                  <a href={exportHref(document, "print")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Print</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Business Documents & Reports Centre</h2>
        <p className="mt-2 text-sm text-slate-600">Every document is available in PDF, Excel and Print formats from its business area and this centre.</p>
        <div className="mt-5 grid gap-5">
          {categories.map((category) => {
            const docs = documentCatalog.filter((document) => document.category === category);
            return (
              <article key={category} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                  <h3 className="font-semibold text-slate-950">{category}</h3>
                  <span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-[var(--solva-blue-700)]">{docs.length} documents</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {docs.map((document) => {
                    return (
                      <div key={document.name} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1.25fr_0.8fr_220px] lg:items-center">
                        <div>
                          <p className="font-semibold text-slate-950">{document.name}</p>
                          {document.standout ? <span className="mt-2 inline-block rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Insight report</span> : null}
                        </div>
                        <p className="leading-6 text-slate-600">{document.description}</p>
                        <p className="text-slate-500">{document.strategicPlacement}</p>
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          <a href={exportHref(document, "pdf")} className="rounded-md bg-[var(--solva-blue-700)] px-3 py-2 text-xs font-semibold text-white">PDF</a>
                          <a href={exportHref(document, "excel")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Excel</a>
                          <a href={exportHref(document, "print")} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Print</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Available areas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{category}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Analytics catalogue</h2>
        <p className="mt-2 text-sm text-slate-600">Power users can still access every report when they need the detailed view.</p>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          {reportingHub.slice(0, 24).map((report) => (
            <div key={`${report.category}-${report.name}`} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-[0.5fr_1fr_1fr]">
              <span className="font-semibold">{report.category}</span>
              <span>{report.name}</span>
              <span className="text-slate-600">Screen, CSV, workbook and PDF-ready</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
