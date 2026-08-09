import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, ReceiptText, UserPlus } from "lucide-react";
import { completeProcessAction, reverseSalesInvoiceAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
import { PinProtectedSubmitButton } from "@/components/app/pin-protected-export";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { salesSummary, salesWorkflows } from "@/lib/sales-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

type CustomerOption = {
  id: string;
  customer_name: string | null;
  customer_code: string | null;
};

type SupplierOption = {
  id: string;
  trading_name: string | null;
  legal_name: string | null;
  supplier_code: string | null;
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

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Nairobi",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function kraEtrWindowLabel(today: string) {
  const date = new Date(`${today.slice(0, 7)}-01T00:00:00+03:00`);
  const month = new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(date);
  return `1 to 19 ${month}`;
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

function newestInvoiceFirst(a: SalesInvoiceRow, b: SalesInvoiceRow) {
  const aTime = new Date(a.created_at || a.invoice_date || 0).getTime();
  const bTime = new Date(b.created_at || b.invoice_date || 0).getTime();
  return bTime - aTime;
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
    const admin = createSupabaseAdminClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId = await activeSalesBusinessId(userData.user?.id, userData.user?.app_metadata?.active_business_id);
    if (!businessId) return [];

    const { data, error } = await admin
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

async function activeSalesBusinessId(userId: string | undefined, metadataBusinessIdValue: unknown) {
  if (!userId) return null;
  const admin = createSupabaseAdminClient();
  const cookieBusinessId = await getActiveBusinessId();
  const metadataBusinessId = typeof metadataBusinessIdValue === "string" ? metadataBusinessIdValue : null;
  const { data: memberships } = await admin
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .eq("active", true)
    .order("joined_at", { ascending: true });
  const membershipIds = (memberships ?? []).map((membership) => String(membership.business_id));
  return (
    (cookieBusinessId && membershipIds.includes(cookieBusinessId) ? cookieBusinessId : null) ||
    (metadataBusinessId && membershipIds.includes(metadataBusinessId) ? metadataBusinessId : null) ||
    membershipIds[0] ||
    null
  );
}

async function salesCustomers() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId = await activeSalesBusinessId(userData.user?.id, userData.user?.app_metadata?.active_business_id);
    if (!businessId) return [] as CustomerOption[];
    const { data } = await admin
      .from("customers")
      .select("id, customer_name, customer_code")
      .eq("business_id", businessId)
      .order("customer_name", { ascending: true })
      .limit(2000);
    return (data ?? []) as CustomerOption[];
  } catch (error) {
    console.warn("Could not load sales report customers", error);
    return [] as CustomerOption[];
  }
}

async function salesSuppliers() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId = await activeSalesBusinessId(userData.user?.id, userData.user?.app_metadata?.active_business_id);
    if (!businessId) return [] as SupplierOption[];
    const { data } = await admin
      .from("suppliers")
      .select("id, trading_name, legal_name, supplier_code")
      .eq("business_id", businessId)
      .order("trading_name", { ascending: true })
      .limit(2000);
    return (data ?? []) as SupplierOption[];
  } catch (error) {
    console.warn("Could not load sales report suppliers", error);
    return [] as SupplierOption[];
  }
}

export default async function SalesPage() {
  const [invoices, customers, suppliers] = await Promise.all([recentSales(), salesCustomers(), salesSuppliers()]);
  const today = todayIsoDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const kraWindow = kraEtrWindowLabel(today);
  const activeInvoices = invoices.filter((invoice) => !isReversedSale(invoice));
  const invoicesNeedingFollowUp = activeInvoices.filter((invoice) => asNumber(invoice.balance_due) > 0).sort(newestInvoiceFirst);
  const completedInvoices = activeInvoices.filter((invoice) => asNumber(invoice.balance_due) <= 0).sort(newestInvoiceFirst);

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
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Sales History</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">View invoices, payments, balances and receipts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Paid and concluded sales stay here. Only invoices still waiting for payment remain in the follow-up list below.
            </p>
            <details className="mt-4 rounded-md border border-slate-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--solva-blue-800)]">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Sales History
                </span>
                <span className="rounded-full bg-white/15 px-2 py-1 text-xs">{completedInvoices.length}</span>
              </summary>
              <div className="max-h-80 overflow-auto p-3">
                {completedInvoices.length ? (
                  <div className="grid gap-2">
                    {completedInvoices.slice(0, 30).map((invoice) => (
                      <div key={invoice.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-950">{invoice.invoice_number || "Sale without number"}</p>
                            <p className="text-xs text-slate-500">{customerName(invoice)} - {invoice.invoice_date || "not dated"}</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">PAID</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-800">{money(asNumber(invoice.total_amount))}</p>
                          <div className="flex flex-wrap gap-2">
                            <a href={salesDocumentHref(invoice, "Invoice")} className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                              Invoice
                            </a>
                            <a href={receiptHref(invoice)} className="inline-flex min-h-9 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white">
                              Receipt
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                    {completedInvoices.length > 30 ? (
                      <p className="text-xs font-semibold text-slate-500">Showing latest 30 paid sales. Use reports for the full archive.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No paid sales are archived yet.</p>
                )}
              </div>
            </details>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">Customer Sales Reports</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Sales by customer</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Pick all customers or one customer, choose dates, then download.</p>
            <a
              href="#customer-sales-reports"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white"
            >
              <FileText className="h-4 w-4" />
              Open Reports
            </a>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-amber-700">Supplier Sales Reports</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Profit by supplier</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">See whose goods sold best and brought the strongest gross profit.</p>
            <a
              href="#supplier-sales-reports"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white"
            >
              <FileText className="h-4 w-4" />
              Open Reports
            </a>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Accountant VAT Report</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">KRA PIN sales</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sales to customers with KRA PINs for {kraWindow}.</p>
            <a
              href="#vat-filing-report"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white"
            >
              <FileText className="h-4 w-4" />
              Open Report
            </a>
          </div>
        </div>
      </section>

      <section id="customer-sales-reports" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Customer sales statements</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Download all sales or one customer&apos;s sales</h2>
          </div>
          <Link href="/reports" className="text-sm font-semibold text-[var(--solva-blue-700)]">Full report centre</Link>
        </div>
        <form action="/api/exports" className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <input type="hidden" name="module" value="Sales" />
          <input type="hidden" name="process" value="Customer Sales Statement" />
          <label className="text-sm font-semibold text-slate-700">
            Customer
            <select name="customerId" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_name || customer.customer_code || "Unnamed customer"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            From
            <input name="from" type="date" defaultValue={monthStart} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            To
            <input name="to" type="date" defaultValue={today} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <div className="grid gap-2 sm:grid-cols-3 md:min-w-72">
            <PinProtectedSubmitButton name="format" value="pdf" className="min-h-11 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">PDF</PinProtectedSubmitButton>
            <PinProtectedSubmitButton name="format" value="excel" className="min-h-11 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-[var(--solva-blue-700)]">Excel</PinProtectedSubmitButton>
            <PinProtectedSubmitButton name="format" value="print" className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Print</PinProtectedSubmitButton>
          </div>
        </form>
      </section>

      <section id="supplier-sales-reports" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-amber-700">Supplier sales reports</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Download sales and profit by supplier/source</h2>
          </div>
          <Link href="/reports" className="text-sm font-semibold text-[var(--solva-blue-700)]">Full report centre</Link>
        </div>
        <form action="/api/exports" className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-end">
          <input type="hidden" name="module" value="Sales" />
          <input type="hidden" name="process" value="Profit by Supplier and Source Report" />
          <label className="text-sm font-semibold text-slate-700">
            Supplier
            <select name="supplierId" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">All suppliers and sources</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.trading_name || supplier.legal_name || supplier.supplier_code || "Unnamed supplier"}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              {suppliers.length ? `${suppliers.length} saved supplier${suppliers.length === 1 ? "" : "s"} available` : "No saved suppliers yet. Add suppliers first or use all sources."}
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Source
            <select name="sourceType" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="all">All sources</option>
              <option value="direct_supplier">Direct supplier</option>
              <option value="local_market">Local market</option>
              <option value="tz_supplier">Tanzania Supplier</option>
              <option value="unspecified">Not recorded</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            From
            <input name="from" type="date" defaultValue={monthStart} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            To
            <input name="to" type="date" defaultValue={today} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <div className="grid gap-2 sm:grid-cols-3 md:min-w-72">
            <PinProtectedSubmitButton name="format" value="pdf" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
              <Eye className="h-4 w-4" />
              PDF
            </PinProtectedSubmitButton>
            <PinProtectedSubmitButton name="format" value="excel" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-[var(--solva-blue-700)]">
              <Eye className="h-4 w-4" />
              Excel
            </PinProtectedSubmitButton>
            <PinProtectedSubmitButton name="format" value="print" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
              <Eye className="h-4 w-4" />
              Print
            </PinProtectedSubmitButton>
          </div>
        </form>
      </section>

      <section id="vat-filing-report" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-rose-700">Accountant VAT report</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">KRA ETR sales for VAT filing</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Includes only sales to customers with KRA PINs for {kraWindow}, ready for the accountant before the 20th.
            </p>
          </div>
          <Link href="/reports" className="text-sm font-semibold text-[var(--solva-blue-700)]">Full report centre</Link>
        </div>
        <form action="/api/exports" className="mt-4 flex flex-col gap-3 rounded-md bg-slate-50 p-4 md:flex-row md:items-end md:justify-between">
          <input type="hidden" name="module" value="Tax" />
          <input type="hidden" name="process" value="KRA ETR Sales Report" />
          <div>
            <p className="text-sm font-semibold text-slate-700">VAT preparation period</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{kraWindow}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 md:min-w-72">
            <button name="format" value="pdf" className="min-h-11 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">PDF</button>
            <button name="format" value="excel" className="min-h-11 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-[var(--solva-blue-700)]">Excel</button>
            <button name="format" value="print" className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Print</button>
          </div>
        </form>
      </section>

      <section id="invoice-history" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Sales and payments</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Payment confirmation queue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only unpaid and part-paid invoices appear here. Once payment is confirmed, the sale moves into the Sales History card above.
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

        {invoicesNeedingFollowUp.length ? (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
            {invoicesNeedingFollowUp.map((invoice) => {
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
              title="No sales need payment confirmation"
              description="Paid sales are kept in Sales History. New unpaid or part-paid invoices will appear here for follow-up."
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
