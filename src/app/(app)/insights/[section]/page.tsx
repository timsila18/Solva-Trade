import Link from "next/link";
import { notFound } from "next/navigation";
import {
  alertExamples,
  commandCentreFacts,
  dataQualityMetrics,
  executiveDashboards,
  healthCategories,
  morningBrief,
  systemHealthMetrics,
  timelineFoundation,
  widgetCatalog,
} from "@/lib/business-intelligence-data";
import { executiveReports, generateRecommendations } from "@/lib/business-intelligence";

const sectionCopy: Record<string, { title: string; body: string }> = {
  "business-health": { title: "Business Health", body: "Weighted 0-100 score from configurable KPI components, each with trend, explanation and recommendation." },
  "morning-briefs": { title: "Morning Brief Archive", body: "Stored daily briefings backed by source facts, not invented narrative." },
  "business-memory": { title: "Business Memory", body: "Historical intelligence for comparing periods, explaining changes and tracking issue age from stored records." },
  alerts: { title: "Alerts", body: "Information, warning, critical and escalation alerts with status, module, source record and recommended action." },
  recommendations: { title: "Recommendations", body: "Rule-based recommendations that suggest decisions without performing any business action automatically." },
  trends: { title: "Trends", body: "Day, week, month, quarter, year and rolling comparisons versus previous, budget, forecast, target, branch and last year." },
  forecasts: { title: "Forecast Indicators", body: "Projected cash, revenue, expenses, stockouts, supplier payments, tax obligations and budget outcome, clearly labelled as forecasts." },
  "data-quality": { title: "Data Quality", body: "Missing PINs, unmapped products, negative inventory, unmatched payments, failed journals, duplicate records and setup gaps." },
  "system-health": { title: "System Health", body: "Database, queue, background job, integration, storage, backup, response-time and error health foundations." },
};

export default async function InsightSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const roleDashboard = executiveDashboards.find((dashboard) => dashboard.audience === section);
  const copy = roleDashboard
    ? { title: roleDashboard.audience.replaceAll("_", " "), body: roleDashboard.focus }
    : sectionCopy[section];
  if (!copy) notFound();

  const recommendations = generateRecommendations(alertExamples);
  const widgets = roleDashboard
    ? widgetCatalog.filter((widget) => roleDashboard.widgets.includes(widget.key))
    : widgetCatalog;

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link href="/insights" className="text-sm font-semibold text-emerald-700">Insights</Link>
          <h1 className="mt-1 text-3xl font-semibold">{copy.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{copy.body}</p>
        </div>
        <Link href="/dashboard" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
          Command centre
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {commandCentreFacts.slice(0, 8).map((fact) => (
          <article key={fact.label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{fact.label}</p>
            <h2 className="mt-3 text-xl font-semibold">{fact.value}</h2>
            <p className="mt-3 text-sm text-slate-600">{fact.source}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Widgets</h2>
          <div className="mt-4 grid gap-2">
            {widgets.map((widget) => (
              <div key={widget.key} className="rounded-md bg-slate-100 px-3 py-3 text-sm">
                <span className="font-semibold">{widget.title}</span>
                <span className="ml-2 text-slate-600">{widget.kind.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Morning Brief</h2>
          <p className="mt-4 text-sm leading-6 text-slate-700">{morningBrief.summary}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Recommendations</h2>
          <div className="mt-4 grid gap-2">
            {recommendations.slice(0, 5).map((recommendation) => (
              <div key={recommendation.code} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{recommendation.title}</span>
                <p className="mt-2 text-slate-600">{recommendation.recommendedAction}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Timeline</h2>
          <div className="mt-4 grid gap-2">
            {timelineFoundation.map((event) => (
              <div key={`${event.module}-${event.title}`} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{event.module}</span>
                <span className="ml-2 text-slate-700">{event.title}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Reports and Checks</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...executiveReports, ...healthCategories.map((item) => item.category), ...dataQualityMetrics, ...systemHealthMetrics].slice(0, 32).map((item) => (
              <span key={item} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{item}</span>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
