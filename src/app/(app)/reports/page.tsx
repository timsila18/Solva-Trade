import { FileText } from "lucide-react";
import { MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import {
  pinnedReports,
  reportingHub,
  scheduledReportFrequencies,
} from "@/lib/business-intelligence-data";

const categories = Array.from(new Set(reportingHub.map((report) => report.category)));

const ownerQuestions = [
  { title: "How is the business doing?", href: "/insights/owner", description: "Revenue, cash, profit, risks and the next actions an owner should care about." },
  { title: "Who owes me money?", href: "/sales/debtor-ageing", description: "Customer balances, late payments and follow-up priorities in one place." },
  { title: "What stock needs attention?", href: "/inventory/reports", description: "Low stock, expiry risk, valuation and movement reports." },
  { title: "What tax work is due?", href: "/tax", description: "VAT, eTIMS, withholding and filing readiness." },
];

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
        <MetricCard label="Reports available" value={reportingHub.length.toString()} story="Grouped by the question they answer." />
        <MetricCard label="Report categories" value={categories.length.toString()} story="Owner, sales, stock, cash, finance and tax views." />
        <MetricCard label="Pinned reports" value={pinnedReports.length.toString()} story="Fast access to the reports used most often." />
        <MetricCard label="Scheduled reports" value="Ready" story="Email-ready and download-ready foundation." tone="good" />
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
          <h2 className="font-semibold">Available areas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{category}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Full report catalogue</h2>
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
