import Link from "next/link";
import { ArrowRight, Banknote, PackagePlus, ReceiptText, ShieldCheck } from "lucide-react";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import {
  alertExamples,
  commandCentreFacts,
  executiveDashboards,
  morningBrief,
  quickActions,
  timelineFoundation,
} from "@/lib/business-intelligence-data";
import { generateRecommendations, rankAlerts } from "@/lib/business-intelligence";
import { demoBranches, demoBusinesses } from "@/lib/mock-data";

const alerts = rankAlerts(alertExamples);
const recommendations = generateRecommendations(alertExamples).slice(0, 3);

const ownerSummary = [
  "No live sales have been posted yet, so today is ready for your first clean transaction.",
  "Cash, stock, customer balances and tax reminders will explain themselves here as soon as work starts.",
  "The fastest next step is to record a sale or receive stock so Solva can begin telling the story of the business.",
];

const topActions = [
  { label: "New Sale", href: "/sales/invoices", icon: ReceiptText },
  { label: "Receive Stock", href: "/purchases/goods-received", icon: PackagePlus },
  { label: "Record Payment", href: "/cash-bank/receipts", icon: Banknote },
];

export default function DashboardPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Good morning Timothy"
        title={`${demoBusinesses[0].tradingName} is ready for today.`}
        description="This is the owner view: money in, money owed, stock risks and next actions in plain language before the detailed reports."
        primaryAction={{ label: "Start a Sale", href: "/sales/invoices", icon: ReceiptText }}
        secondaryAction={{ label: "Open Reports", href: "/reports" }}
        insight="When real activity starts, I will highlight unusual sales drops, overdue customers, low stock and tax deadlines here before they become expensive surprises."
      />

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {topActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-emerald-800">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-slate-950">{action.label}</span>
                <span className="text-sm text-slate-500">One click to begin</span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Plain-language brief</p>
              <h2 className="mt-1 text-xl font-semibold">What you need to know now</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {demoBranches[0].name}
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {ownerSummary.map((statement) => (
              <p key={statement} className="rounded-md bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {statement}
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">{morningBrief.summary}</p>
        </article>

        <article className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-900">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-semibold">Business Health</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-emerald-950">
            No score yet. Solva will calculate this from real sales, collections, stock, supplier payments and tax activity.
          </p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full w-1/6 rounded-full bg-emerald-600" />
          </div>
          <Link href="/insights" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
            See what affects the score
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Money collected today" value="KES 0.00" story="No receipts yet. Record the first payment when money lands." />
        <MetricCard label="Money customers owe you" value="KES 0.00" story="This stays clean until invoices are posted." />
        <MetricCard label="Stock value" value="KES 0.00" story="Receive stock to begin tracking value and reorder needs." />
        <MetricCard label="Tax status" value="No open filing" story="VAT reminders will appear before due dates." tone="good" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Today&apos;s Priorities</h2>
          <div className="mt-4 grid gap-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.code} className="rounded-md border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{alert.title}</h3>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{alert.severity}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Recommended Actions</h2>
          <div className="mt-4 grid gap-3">
            {recommendations.map((item) => (
              <div key={item.code} className="rounded-md bg-slate-50 px-3 py-3">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.recommendedAction}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Quick Actions</h2>
          <div className="mt-4 grid gap-2">
            {quickActions.slice(0, 5).map((action) => (
              <Link key={action.href} href={action.href} className="rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold hover:border-emerald-300">
                {action.label}
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Recent Activity</h2>
          <p className="mt-2 text-sm text-slate-600">The latest sales, payments, stock moves and tax events will appear here.</p>
          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            {timelineFoundation.slice(0, 5).map((event) => (
              <div key={`${event.module}-${event.title}`} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1.4fr_1fr]">
                <span className="font-semibold">{event.time}</span>
                <span>{event.module}</span>
                <span className="text-slate-600">{event.title}</span>
                <span className="text-emerald-700">{event.quickAction}</span>
              </div>
            ))}
          </div>
        </article>

        <EmptyState
          title="No business story yet"
          description="Once you create the first sale, payment or stock receipt, this dashboard will turn those records into simple daily guidance."
          action={{ label: "Create First Sale", href: "/sales/invoices" }}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {executiveDashboards.slice(0, 4).map((dashboard) => (
          <PlainCard
            key={dashboard.audience}
            href={`/insights/${dashboard.audience}`}
            title={dashboard.audience.replaceAll("_", " ")}
            description={dashboard.focus}
            action="View role dashboard"
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {commandCentreFacts.slice(0, 4).map((fact) => (
          <MetricCard
            key={fact.label}
            label={fact.label}
            value={String(fact.value ?? "No data yet")}
            story={`${fact.source}. ${fact.forecast ? "Forecast appears when enough history exists." : "Updated from posted records."}`}
          />
        ))}
      </section>
    </div>
  );
}
