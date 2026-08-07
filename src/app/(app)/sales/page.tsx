import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, ReceiptText, UserPlus } from "lucide-react";
import { completeProcessAction, reverseSalesInvoiceAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { salesSummary, salesWorkflows } from "@/lib/sales-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type SalesInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  created_at?: string | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
  balance_due: number | string | null;
  status: string | null;
  customers: { customer_name: string | null; phone: string | null } | { customer_name: string | null; phone: string | null }[] | null;
};

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
      title: "Make quotation",
      description: "",
      action: "",
    },
    "Sales orders": {
      title: "Sales orders",
      description: "",
      action: "",
    },
    Invoices: {
      title: "Make sale",
      description: "",
      action: "",
    },
    "Customer payments": {
      title: "Record payment",
      description: "",
      action: "",
    },
    "Customer returns": {
      title: "Returns",
      description: "",
      action: "",
    },
    "Debtor ageing": {
      title: "Late payments",
      description: "",
      action: "",
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

function money(value: number) {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function asNumber(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function customerName(invoice: SalesInvoiceRow) {
  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
  return customer?.customer_name || "Walk-in customer";
}

function daysSince(dateValue: string | null) {
  if (!dateValue) return 0;
  const then = new Date(dateValue);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000));
}

function isReversedSale(invoice: SalesInvoiceRow) {
  const status = String(invoice.status ?? "").toLowerCase();
  return status === "reversed" || status === "cancelled";
}

function receiptHref(invoice: SalesInvoiceRow) {
  return salesDocumentHref(invoice, "Sales Receipt");
}

function salesDocumentHref(invoice: SalesInvoiceRow, process: "Sales Receipt" | "Invoice") {
  const total = asNumber(invoice.total_amount);
  const paid = asNumber(invoice.amount_paid);
  const balance = asNumber(invoice.balance_due);
  const params = new URLSearchParams({
    module: "Sales",
    process,
    format: "pdf",
    invoiceId: invoice.id,
    label_invoice_number: "Invoice number",
    field_invoice_number: invoice.invoice_number || invoice.id,
    label_receipt_number: "Receipt number",
    field_receipt_number: invoice.invoice_number || invoice.id,
    label_customer: "Customer",
    field_customer: customerName(invoice),
    label_invoice_date: "Invoice date",
    field_invoice_date: invoice.invoice_date || "",
    label_delivery_date: "Delivery date",
    field_delivery_date: invoice.invoice_date || "",
    label_delivery_status: "Delivery status",
    field_delivery_status: "Ready for delivery",
    label_amount_paid: "Amount paid",
    field_amount_paid: paid.toFixed(2),
    label_total: "Total",
    field_total: total.toFixed(2),
    label_balance_due: "Balance due",
    field_balance_due: balance.toFixed(2),
    label_payment_status: "Payment status",
    field_payment_status: balance <= 0 ? "Paid" : paid > 0 ? "Part paid" : "Unpaid",
  });
  return `/api/exports?${params.toString()}`;
}

async function recentSales() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
    if (!businessId) return [];

    const { data, error } = await supabase
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, created_at, total_amount, amount_paid, balance_due, status, customers(customer_name, phone)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Could not load sales invoice desk", error);
      return [];
    }
    return (data ?? []) as SalesInvoiceRow[];
  } catch (error) {
    console.warn("Sales invoice desk skipped", error);
    return [];
  }
}

export default async function SalesPage() {
  const invoices = await recentSales();
  const invoicesNeedingFollowUp = invoices.filter((invoice) => asNumber(invoice.balance_due) > 0);
  const orderedInvoices = [...invoices].sort((a, b) => {
    const aOpen = asNumber(a.balance_due) > 0 ? 0 : 1;
    const bOpen = asNumber(b.balance_due) > 0 ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const aTime = new Date(a.created_at || a.invoice_date || 0).getTime();
    const bTime = new Date(b.created_at || b.invoice_date || 0).getTime();
    return bTime - aTime;
  });

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

      <section className="mt-6 rounded-lg border border-cyan-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Sales History</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">View invoices, payments, balances and receipts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open one clear history list for all posted sales, paid receipts, part payments and follow-ups.
            </p>
          </div>
          <a
            href="#invoice-history"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--solva-blue-800)]"
          >
            <FileText className="h-4 w-4" />
            Sales History
          </a>
        </div>
      </section>

      <section id="invoice-history" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Sales and payments</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">All sales, invoices, balances and receipts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Every new sale appears here as an invoice first. Confirm payment from this list to generate the receipt instantly; unpaid or part-paid sales stay visible with the balance.
            </p>
          </div>
          {invoicesNeedingFollowUp.length ? (
            <div className="inline-flex min-h-10 items-center gap-2 rounded-md bg-amber-50 px-3 text-sm font-semibold text-amber-800">
              <Clock3 className="h-4 w-4" />
              {invoicesNeedingFollowUp.length} payment follow-up{invoicesNeedingFollowUp.length === 1 ? "" : "s"}
            </div>
          ) : (
            <div className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              No open balances
            </div>
          )}
        </div>

        {invoices.length ? (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
            {orderedInvoices.map((invoice) => {
              const total = asNumber(invoice.total_amount);
              const paid = asNumber(invoice.amount_paid);
              const balance = asNumber(invoice.balance_due);
              const reversed = isReversedSale(invoice);
              const isPaid = balance <= 0;
              const isPartPaid = !isPaid && paid > 0;
              const age = daysSince(invoice.invoice_date);
              const shouldRemind = balance > 0 && age >= 3;
              return (
                <article key={invoice.id} className="grid gap-4 bg-white p-4 lg:grid-cols-[1.35fr_1fr_1.25fr] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{invoice.invoice_number || "Sale without number"}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black tracking-wide ${
                          reversed
                            ? "bg-slate-200 text-slate-700"
                            : isPaid
                            ? "bg-emerald-100 text-emerald-800"
                            : isPartPaid
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {reversed ? "REVERSED" : isPaid ? "PAID" : isPartPaid ? "PART PAID" : "UNPAID"}
                      </span>
                      {shouldRemind ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Follow up today
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{customerName(invoice)}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sale date {invoice.invoice_date || "not dated"} {age ? `- ${age} day${age === 1 ? "" : "s"} old` : ""}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Total</dt>
                      <dd className="mt-1 font-semibold text-slate-950">{money(total)}</dd>
                    </div>
                    <div className="rounded-md bg-emerald-50 p-3">
                      <dt className="text-xs font-semibold text-emerald-700">Paid</dt>
                      <dd className="mt-1 font-semibold text-emerald-950">{money(paid)}</dd>
                    </div>
                    <div className="rounded-md bg-amber-50 p-3">
                      <dt className="text-xs font-semibold text-amber-700">Balance</dt>
                      <dd className="mt-1 font-semibold text-amber-950">{money(balance)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-2">
                    {reversed ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                        This sale was reversed. Stock has been restored and the invoice no longer counts in live totals.
                      </div>
                    ) : isPaid ? (
                      <a href={receiptHref(invoice)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
                        <ReceiptText className="h-4 w-4" />
                        Download PAID receipt
                      </a>
                    ) : (
                      <PersistedForm action={completeProcessAction} draftKey={`solva-trade:payment:${invoice.id}`} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <input type="hidden" name="module" value="Sales" />
                        <input type="hidden" name="process" value="Customer Payments" />
                        <input type="hidden" name="document" value="Sales Receipt" />
                        <input type="hidden" name="intent" value="Submitted" />
                        <input type="hidden" name="returnTo" value="/sales" />
                        <input type="hidden" name="next" value="Back to sales" />
                        <input type="hidden" name="label_invoice_id" value="Invoice ID" />
                        <input type="hidden" name="field_invoice_id" value={invoice.id} />
                        <input type="hidden" name="label_invoice_number" value="Invoice number" />
                        <input type="hidden" name="field_invoice_number" value={invoice.invoice_number || invoice.id} />
                        <input type="hidden" name="label_customer" value="Customer" />
                        <input type="hidden" name="field_customer" value={customerName(invoice)} />
                        <input type="hidden" name="label_total" value="Total" />
                        <input type="hidden" name="field_total" value={total.toFixed(2)} />
                        <input type="hidden" name="label_balance_due" value="Balance due" />
                        <input type="hidden" name="field_balance_due" value="0.00" />
                        <input type="hidden" name="label_payment_status" value="Payment status" />
                        <input type="hidden" name="field_payment_status" value="Paid" />
                        <input type="hidden" name="label_payment_method" value="Payment method" />
                        <input type="hidden" name="field_payment_method" value="Cash" />
                        <label className="text-xs font-semibold text-slate-600" htmlFor={`amount-${invoice.id}`}>Amount received</label>
                        <div className="flex gap-2">
                          <input
                            id={`amount-${invoice.id}`}
                            name="field_amount"
                            type="number"
                            min="0.01"
                            max={balance.toFixed(2)}
                            step="0.01"
                            defaultValue={balance.toFixed(2)}
                            className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold"
                          />
                          <button type="submit" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
                            Confirm & receipt
                          </button>
                        </div>
                        <p className="text-xs leading-5 text-slate-500">Use the full balance for paid, or a smaller amount for part payment.</p>
                      </PersistedForm>
                    )}
                    <a href={salesDocumentHref(invoice, "Invoice")} className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700">
                      Download invoice
                    </a>
                    {!reversed ? (
                      <details className="rounded-md border border-rose-100 bg-rose-50 p-2">
                        <summary className="flex cursor-pointer items-center justify-center gap-2 text-xs font-black text-rose-700">
                          <Eye className="h-3.5 w-3.5" />
                          Reverse
                        </summary>
                        <form action={reverseSalesInvoiceAction} className="mt-3 grid gap-2">
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <label className="text-xs font-semibold text-rose-800" htmlFor={`reverse-pin-${invoice.id}`}>
                            Owner PIN
                          </label>
                          <input
                            id={`reverse-pin-${invoice.id}`}
                            name="reverse_pin"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                            placeholder="Enter PIN"
                            className="min-h-9 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-slate-800"
                          />
                          <label className="text-xs font-semibold text-rose-800" htmlFor={`reverse-reason-${invoice.id}`}>
                            Reason
                          </label>
                          <input
                            id={`reverse-reason-${invoice.id}`}
                            name="reason"
                            defaultValue="Sale cancelled or entered by mistake."
                            className="min-h-9 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-slate-800"
                          />
                          <button type="submit" className="inline-flex min-h-9 items-center justify-center rounded-md bg-rose-700 px-3 text-xs font-black text-white">
                            Confirm reverse
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No sales have been posted yet"
              description="Once a sale is submitted, it will appear here with paid, part-paid or unpaid status and instant receipt actions."
              action={{ label: "Create First Sale", href: "/sales/invoices" }}
            />
          </div>
        )}
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
