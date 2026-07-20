import Link from "next/link";
import {
  alertExamples,
  dataQualityMetrics,
  executiveDashboards,
  healthCategories,
  systemHealthMetrics,
  widgetCatalog,
} from "@/lib/business-intelligence-data";
import { executiveReports } from "@/lib/business-intelligence";

const sections = [
  { title: "Business Health", href: "/insights/business-health", description: "Overall and component scores with trends, explanations and recommendations." },
  { title: "Morning Brief Archive", href: "/insights/morning-briefs", description: "Daily owner briefs stored historically with source-backed statements." },
  { title: "Business Memory", href: "/insights/business-memory", description: "Historical questions such as what changed, why margin moved and how long issues existed." },
  { title: "Alerts", href: "/insights/alerts", description: "Information, warning, critical, escalation, expired and resolved operating alerts." },
  { title: "Recommendations", href: "/insights/recommendations", description: "Rule-based recommendations that never perform actions automatically." },
  { title: "Trends", href: "/insights/trends", description: "Day, week, month, quarter, year and rolling comparisons." },
  { title: "Forecast Indicators", href: "/insights/forecasts", description: "Clearly labelled projected cash, revenue, expenses, stockouts and tax obligations." },
  { title: "Data Quality", href: "/insights/data-quality", description: "Missing PINs, missing prices, unmatched payments and setup gaps." },
  { title: "System Health", href: "/insights/system-health", description: "Database, queue, integration, storage, backup and runtime health foundations." },
];

export default function InsightsPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Decision intelligence</p>
          <h1 className="mt-1 text-3xl font-semibold">Insights Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Role dashboards, business memory, trends, alerts, recommendations, forecasts and operating health signals from stored Solva Trade records.
          </p>
        </div>
        <Link href="/dashboard" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Command centre
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{section.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Role Dashboards</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {executiveDashboards.map((dashboard) => (
            <Link key={dashboard.audience} href={`/insights/${dashboard.audience}`} className="rounded-md border border-slate-200 px-3 py-3 hover:border-emerald-300">
              <h3 className="text-sm font-semibold">{dashboard.audience.replaceAll("_", " ")}</h3>
              <p className="mt-2 text-sm text-slate-600">{dashboard.focus}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Health Components</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {healthCategories.map((component) => (
              <span key={component.category} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{component.category}</span>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Alert Types</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {alertExamples.map((alert) => (
              <span key={alert.code} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{alert.title}</span>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Reports</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {executiveReports.map((report) => (
              <span key={report} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{report}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Reusable Widgets</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {widgetCatalog.map((widget) => (
              <div key={widget.key} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{widget.title}</span>
                <span className="ml-2 text-slate-500">{widget.kind.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Quality and System Checks</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {[...dataQualityMetrics, ...systemHealthMetrics].map((metric) => (
              <div key={metric} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">{metric}</div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
