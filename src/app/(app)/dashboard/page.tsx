import Link from "next/link";
import { ArrowRight, Banknote, CreditCard, Download, Eye, PackagePlus, ReceiptText, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Users } from "lucide-react";
import { DashboardPanel, DashboardTile, EmptyState, MetricCard, MiniBars, PageHero, PlainCard, ProgressRow } from "@/components/ui/premium";
import {
  alertExamples,
  commandCentreFacts,
  executiveDashboards,
  morningBrief,
  quickActions,
  timelineFoundation,
} from "@/lib/business-intelligence-data";
import { generateRecommendations, rankAlerts } from "@/lib/business-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const attentionRows = [
  ["Invoices", "No invoices yet", "Draft", "Create", "/sales/invoices"],
  ["Stock receipts", "No GRNs posted yet", "Ready", "Receive", "/purchases/goods-received"],
  ["Customers", "Customer list is empty", "Setup", "Add", "/customers/new"],
  ["Reports", "Daily report is available", "Download", "Export", "/api/exports?module=Reports&process=Daily%20Report&format=pdf"],
];

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const userName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user?.email?.split("@")[0] ?? "there";
  const metadataBusinessId = typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null;
  const metadataBusinessName =
    typeof user?.app_metadata?.business_name === "string" ? user.app_metadata.business_name : "Your business";

  let businessName = metadataBusinessName;
  let branchName = "Main workspace";
  let businessId = metadataBusinessId;

  if (user) {
    const { data: membership } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    businessId = membership?.business_id ?? businessId;

    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("trading_name, legal_name")
        .eq("id", businessId)
        .maybeSingle();
      businessName = business?.trading_name ?? business?.legal_name ?? businessName;

      const { data: branch } = await supabase
        .from("branches")
        .select("branch_name")
        .eq("business_id", businessId)
        .eq("active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      branchName = branch?.branch_name ?? branchName;
    }
  }

  return (
    <div className="pb-24">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardTile label="Today sales" value="KES 0" caption="No sale posted yet" icon={ShoppingCart} tone="blue" />
        <DashboardTile label="Cash collected" value="KES 0" caption="Receipts appear here" icon={Banknote} tone="green" />
        <DashboardTile label="Customers owing" value="KES 0" caption="Follow-up list is clean" icon={CreditCard} tone="gold" />
        <DashboardTile label="Active customers" value="0" caption="Create the first customer" icon={Users} tone="cyan" />
        <DashboardTile label="Stock alerts" value="0" caption="Receive stock to monitor" icon={PackagePlus} tone="rose" />
      </section>

      <PageHero
        eyebrow={`${greeting()} ${userName}`}
        title={`${businessName} is ready for today.`}
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
              className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-[var(--solva-blue-700)]">
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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Find work quickly</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">Search customer, invoice, product, supplier, GRN or receipt.</h2>
          </div>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs text-[var(--solva-blue-700)]">0</span>
          </button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_150px_150px_150px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="min-h-12 w-full rounded-md border border-slate-300 bg-white py-3 pl-12 pr-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400"
              placeholder="Search anything in this business..."
            />
          </label>
          <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700" defaultValue="all">
            <option value="all">All branches</option>
            <option value="hq">{branchName}</option>
          </select>
          <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700" defaultValue="today">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_120px_110px] gap-4 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
          <span>Workspace area</span>
          <span>What needs attention</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
        {attentionRows.map(([area, detail, status, action, href]) => (
          <div key={area} className="grid min-h-16 grid-cols-[1fr_1fr_120px_110px] items-center gap-4 border-t border-slate-200 px-5 py-4 text-sm">
            <span className="font-semibold text-slate-950">{area}</span>
            <span className="text-slate-600">{detail}</span>
            <span className="w-fit rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-[var(--solva-blue-700)]">{status}</span>
            <Link href={href} className="inline-flex items-center justify-end gap-2 font-semibold text-[var(--solva-blue-700)]">
              {action === "Export" ? <Download className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {action}
            </Link>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel
          title="Sales Activity"
          action={<Link href="/sales/invoices" className="text-sm font-semibold text-[var(--solva-blue-700)]">New sale</Link>}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div>
              <MiniBars values={[18, 31, 24, 42, 36, 57, 49, 65, 70, 84, 76, 92]} />
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>Jan</span>
                <span>Apr</span>
                <span>Jul</span>
                <span>Oct</span>
                <span>Today</span>
              </div>
            </div>
            <div className="grid gap-4">
              <ProgressRow label="Invoices ready" value={0} amount="0" />
              <ProgressRow label="Payments received" value={0} amount="KES 0" />
              <ProgressRow label="Orders to deliver" value={0} amount="0" />
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Inventory Summary"
          action={<Link href="/inventory" className="text-sm font-semibold text-[var(--solva-blue-700)]">Open stock</Link>}
        >
          <div className="grid gap-3">
            {[
              ["Products in catalogue", "0", "Add products before selling or buying."],
              ["Quantity on hand", "0", "Opening stock and receipts update this."],
              ["Low-stock items", "0", "Reorder warnings will appear here."],
              ["Stock value", "KES 0", "Valuation starts after stock is received."],
            ].map(([label, value, description]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-slate-200 px-3 py-3">
                <span>
                  <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
                  <span className="mt-1 block text-sm text-slate-600">{description}</span>
                </span>
                <span className="text-lg font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Plain-language brief</p>
              <h2 className="mt-1 text-xl font-semibold">What you need to know now</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {branchName}
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

        <article className="rounded-lg border border-cyan-100 bg-cyan-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--solva-blue-700)]">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-semibold">Business Health</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            No score yet. Solva will calculate this from real sales, collections, stock, supplier payments and tax activity.
          </p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full w-1/6 rounded-full bg-[var(--solva-cyan-500)]" />
          </div>
          <Link href="/insights" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--solva-blue-700)]">
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
              <Link key={action.href} href={action.href} className="rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold hover:border-cyan-300">
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
