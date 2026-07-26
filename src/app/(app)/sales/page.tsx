import Link from "next/link";
import { FileText, ReceiptText, UserPlus } from "lucide-react";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { salesSummary, salesWorkflows } from "@/lib/sales-data";

const storyCards = [
  {
    label: "Customers buying from you",
    value: salesSummary.activeCustomers.toString(),
    story: "Add customers once, then reuse them for orders, deliveries and payments.",
  },
  {
    label: "Orders ready to deliver",
    value: salesSummary.approvedOrdersReadyForDelivery.toString(),
    story: "Approved orders will flow into route planning when you start selling.",
  },
  {
    label: "Unpaid invoices",
    value: salesSummary.openInvoices.toString(),
    story: "This tells you who still needs a follow-up.",
  },
  {
    label: "Money customers owe you",
    value: salesSummary.customerBalance,
    story: "Plain view of customer balances without accounting jargon.",
  },
];

const plainWorkflows = salesWorkflows.map((workflow) => {
  const labels: Record<string, { title: string; description: string; action: string }> = {
    Quotations: {
      title: "Prepare a Price Offer",
      description: "Send a customer a clear offer before it becomes a sale.",
      action: "Create offer",
    },
    "Sales orders": {
      title: "Confirm What a Customer Wants",
      description: "Approve demand before stock is picked or delivered.",
      action: "Open orders",
    },
    Invoices: {
      title: "Make a Sale",
      description: "Issue an invoice and start tracking what the customer should pay.",
      action: "New sale",
    },
    "Customer payments": {
      title: "Record Money In",
      description: "Capture cash, bank or M-Pesa collections against customer balances.",
      action: "Record payment",
    },
    "Customer returns": {
      title: "Handle Returned Goods",
      description: "Track goods a customer returns and keep balances correct.",
      action: "Open returns",
    },
    "Debtor ageing": {
      title: "Customers Who Are Late",
      description: "See who owes you money and how long it has been outstanding.",
      action: "Review late payments",
    },
  };
  return { ...workflow, ...labels[workflow.title] };
});

const salesReportCards = [
  ["Basic Daily Sales Report", "Daily itemized sales with product, quantity, tax and total."],
  ["Daily Sales KPI Report", "Daily revenue, customers, average order value and growth."],
  ["Hourly Sales Report", "Trading pattern by hour for staffing and cash desk review."],
  ["Sales Tracking Report", "Product revenue, markup and profit tracking."],
  ["Weekly Sales Activity Report", "Weekly activity, deals closed, revenue, target and variance."],
  ["Monthly Sales Report Dashboard", "Month-end sales dashboard for owner and accountant review."],
] as const;

function exportHref(process: string, format: "pdf" | "excel" | "print") {
  return `/api/exports?module=Sales&process=${encodeURIComponent(process)}&format=${format}`;
}

export default function SalesPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Sales"
        title="Sell, get paid, and know who owes you."
        description="This page keeps sales simple: create the sale, deliver the goods, then follow up on payment."
        primaryAction={{ label: "New Sale", href: "/sales/invoices", icon: ReceiptText }}
        secondaryAction={{ label: "Add Customer", href: "/customers/new" }}
        insight="I will warn you when a customer is buying less, paying late, or ordering stock that may run out."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {storyCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {plainWorkflows.map((workflow) => (
          <PlainCard
            key={workflow.href}
            href={workflow.href}
            title={workflow.title}
            description={workflow.description}
            action={workflow.action}
          />
        ))}
      </section>

      <section className="mt-6">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Sales reports</p>
            <h2 className="mt-1 text-xl font-semibold">Download the reports sales teams use daily</h2>
          </div>
          <Link href="/reports" className="text-sm font-semibold text-[var(--solva-blue-700)]">Open full report centre</Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {salesReportCards.map(([name, description]) => (
            <article key={name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">{name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
              <div className="mt-4">
                <a href={exportHref(name, "pdf")} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4" />
                  Generate
                </a>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a href={exportHref(name, "excel")} className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-[var(--solva-blue-700)]">Excel</a>
                  <a href={exportHref(name, "print")} className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700">Print</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <EmptyState
          title="No sales yet"
          description="Create your first sale to start tracking customer balances, delivery readiness and daily revenue."
          action={{ label: "Create First Sale", href: "/sales/invoices" }}
        />
        <EmptyState
          title="No customers yet"
          description="Customers help you save phone numbers, track balances and follow up on payments without searching through notebooks."
          action={{ label: "Add First Customer", href: "/customers/new" }}
        />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="font-semibold">Best next step</h2>
            <p className="mt-2 text-sm text-slate-600">Start with a customer, then create a sale. Solva will remember the defaults next time.</p>
          </div>
          <Link href="/customers/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Link>
        </div>
      </section>
    </div>
  );
}
