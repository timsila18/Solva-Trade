import Link from "next/link";
import { ReceiptText, UserPlus } from "lucide-react";
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
