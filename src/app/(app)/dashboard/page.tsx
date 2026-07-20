import Link from "next/link";
import {
  alertExamples,
  commandCentreFacts,
  commandCentreSections,
  dataQualityMetrics,
  executiveDashboards,
  healthCategories,
  morningBrief,
  pinnedReports,
  quickActions,
  systemHealthMetrics,
  timelineFoundation,
  widgetCatalog,
} from "@/lib/business-intelligence-data";
import { generateRecommendations, rankAlerts } from "@/lib/business-intelligence";
import { demoBranches, demoBusinesses } from "@/lib/mock-data";

const alerts = rankAlerts(alertExamples);
const recommendations = generateRecommendations(alertExamples).slice(0, 6);

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{children}</span>;
}

export default function DashboardPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Business operating system</p>
          <h1 className="mt-1 text-3xl font-semibold">Business Command Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Daily operating view for {demoBusinesses[0].tradingName}, combining posted financial, sales, stock, treasury, tax, accounting and logistics records without invented values.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Reporting hub
          </Link>
          <Link href="/insights" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Insights
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h2 className="text-lg font-semibold">Morning Brief</h2>
              <p className="mt-1 text-sm text-slate-600">{morningBrief.greeting}</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {demoBranches[0].name}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{morningBrief.summary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {morningBrief.statements.slice(0, 6).map((statement) => (
              <p key={statement} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">
                {statement}
              </p>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Business Health</h2>
          <p className="mt-1 text-sm text-slate-600">Score waits for KPI snapshots from posted source records.</p>
          <div className="mt-6 flex aspect-square max-h-56 items-center justify-center rounded-full border-8 border-slate-100 bg-emerald-50">
            <div className="text-center">
              <p className="text-4xl font-semibold text-emerald-900">--</p>
              <p className="mt-1 text-sm text-emerald-800">No score yet</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {commandCentreFacts.map((fact) => (
          <article key={fact.label} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-500">{fact.label}</p>
              {fact.forecast ? <span className="text-xs font-semibold text-emerald-700">Forecast</span> : null}
            </div>
            <h3 className="mt-3 text-xl font-semibold">{fact.value}</h3>
            <p className="mt-3 text-sm text-slate-600">{fact.source}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Today&apos;s Priorities</h2>
          <div className="mt-4 grid gap-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.code} className="rounded-md border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{alert.title}</h3>
                  <span className="text-xs font-semibold text-slate-500">{alert.severity}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Recommended Actions</h2>
          <div className="mt-4 grid gap-3">
            {recommendations.map((item) => (
              <div key={item.code} className="rounded-md bg-slate-100 px-3 py-3">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.recommendedAction}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Quick Actions</h2>
          <div className="mt-4 grid gap-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold hover:border-emerald-300">
                {action.label}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Business Timeline</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            {timelineFoundation.map((event) => (
              <div key={`${event.module}-${event.title}`} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-5">
                <span className="font-semibold">{event.time}</span>
                <span>{event.module}</span>
                <span>{event.title}</span>
                <span className="text-slate-600">{event.importance}</span>
                <span className="text-emerald-700">{event.quickAction}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Business Health Components</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {healthCategories.map((component) => (
              <div key={component.category} className="rounded-md border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{component.category}</h3>
                  <span className="text-xs text-slate-500">{component.trend}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{component.explanation}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pinned Reports</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {pinnedReports.map((report) => (
              <Pill key={report}>{report}</Pill>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Data Quality</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {dataQualityMetrics.slice(0, 8).map((metric) => (
              <Pill key={metric}>{metric}</Pill>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">System Health</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {systemHealthMetrics.map((metric) => (
              <Pill key={metric}>{metric}</Pill>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Dashboard Customisation</h2>
        <p className="mt-2 text-sm text-slate-600">
          Layouts support move, resize, hide, favourite, personal save and restore-default settings through persisted widget layout records.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {widgetCatalog.map((widget) => (
            <div key={widget.key} className="rounded-md bg-slate-100 px-3 py-3 text-sm">
              <span className="font-semibold">{widget.title}</span>
              <span className="mt-1 block text-slate-600">{widget.kind.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Command Centre Coverage</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {commandCentreSections.map((section) => (
            <Pill key={section}>{section}</Pill>
          ))}
        </div>
      </section>
    </div>
  );
}
