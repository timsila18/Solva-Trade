import Link from "next/link";
import { ArrowRight, Banknote, CreditCard, Download, Eye, PackagePlus, ReceiptText, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Users } from "lucide-react";
import { ProfitPrivacyCard } from "@/components/app/profit-privacy-card";
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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const alerts = rankAlerts(alertExamples);
const recommendations = generateRecommendations(alertExamples).slice(0, 3);

const topActions = [
  { label: "New Sale", href: "/sales/invoices", icon: ReceiptText },
  { label: "Receive Stock", href: "/purchases/goods-received", icon: PackagePlus },
  { label: "Record Payment", href: "/cash-bank/receipts", icon: Banknote },
];

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayInNairobi() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Nairobi",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function money(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`;
}

function numeric(value: unknown) {
  const number = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

type WorkflowPayload = {
  fields?: Record<string, { value?: unknown }>;
};

type ProfitAllocationRow = {
  allocated_at: string | null;
  sale_value: number | string | null;
  total_cost: number | string | null;
  gross_profit: number | string | null;
};

function workflowAmount(payload: WorkflowPayload | null | undefined) {
  const fields = payload?.fields ?? {};
  return numeric(fields.total?.value ?? fields.amount?.value ?? fields.subtotal?.value);
}

function startOfWeekIso(today: string) {
  const date = new Date(`${today}T00:00:00+03:00`);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString();
}

function startOfYearIso(today: string) {
  const year = today.slice(0, 4);
  return new Date(`${year}-01-01T00:00:00+03:00`).toISOString();
}

function profitForPeriod(rows: ProfitAllocationRow[], startIso: string, endIso: string) {
  return rows
    .filter((row) => {
      const value = String(row.allocated_at ?? "");
      return value >= startIso && value < endIso;
    })
    .reduce((sum, row) => {
      const explicitProfit = numeric(row.gross_profit);
      if (explicitProfit !== 0) return sum + explicitProfit;
      return sum + numeric(row.sale_value) - numeric(row.total_cost);
    }, 0);
}

function profitCaption(amount: number, period: string) {
  if (amount > 0) return `${period} is profitable from posted sales cost allocations.`;
  if (amount < 0) return `${period} is showing a loss. Review cost, pricing and discounts.`;
  return `No posted profit movement for ${period.toLowerCase()} yet.`;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
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
    const { data: membership } = await admin
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    businessId = membership?.business_id ?? businessId;

    if (businessId) {
      const { data: business } = await admin
        .from("businesses")
        .select("trading_name, legal_name")
        .eq("id", businessId)
        .maybeSingle();
      businessName = business?.trading_name ?? business?.legal_name ?? businessName;

      const { data: branch } = await admin
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

  const today = todayInNairobi();
  const tomorrow = new Date(`${today}T00:00:00+03:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString();
  const todayStartIso = new Date(`${today}T00:00:00+03:00`).toISOString();
  const weekStartIso = startOfWeekIso(today);
  const yearStartIso = startOfYearIso(today);
  let todaySales = 0;
  let todayInvoiceCount = 0;
  let cashCollected = 0;
  let paymentCount = 0;
  let customersOwing = 0;
  let overdueCustomers = 0;
  let activeCustomers = 0;
  let stockAlerts = 0;
  let productsInCatalogue = 0;
  let quantityOnHand = 0;
  let stockValue = 0;
  let taxToday = 0;
  let grnsToday = 0;
  let todayProfit = 0;
  let weekProfit = 0;
  let annualProfit = 0;
  let recentActivity: { time: string; module: string; title: string; quickAction: string }[] = [];

  if (businessId) {
    const [
      invoicesResult,
      paymentsResult,
      customersResult,
      productsResult,
      balancesResult,
      profitAllocationsResult,
      workflowResult,
    ] = await Promise.all([
      admin
        .from("sales_invoices")
        .select("id, invoice_number, invoice_date, subtotal, tax_total, total_amount, amount_paid, balance_due, status, created_at")
        .eq("business_id", businessId),
      admin
        .from("customer_payments")
        .select("id, payment_number, payment_date, amount_received, status, created_at")
        .eq("business_id", businessId),
      admin
        .from("customers")
        .select("id, active, status, current_balance, created_at")
        .eq("business_id", businessId),
      admin
        .from("products")
        .select("id, active, track_inventory, reorder_level, product_name, created_at")
        .eq("business_id", businessId),
      admin
        .from("stock_balances")
        .select("product_id, quantity_on_hand, available_quantity, total_inventory_value, reorder_status")
        .eq("business_id", businessId),
      admin
        .from("sales_source_allocations")
        .select("allocated_at, sale_value, total_cost, gross_profit")
        .eq("business_id", businessId)
        .gte("allocated_at", yearStartIso)
        .lt("allocated_at", tomorrowIso)
        .limit(5000),
      admin
        .from("workflow_records")
        .select("module_name, process_name, document_name, reference_number, record_payload, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const invoices = invoicesResult.data ?? [];
    todayInvoiceCount = invoices.filter((invoice) => String(invoice.invoice_date) === today).length;
    todaySales = invoices
      .filter((invoice) => String(invoice.invoice_date) === today)
      .reduce((sum, invoice) => sum + numeric(invoice.total_amount), 0);
    taxToday = invoices
      .filter((invoice) => String(invoice.invoice_date) === today)
      .reduce((sum, invoice) => sum + numeric(invoice.tax_total), 0);
    customersOwing = invoices.reduce((sum, invoice) => sum + Math.max(0, numeric(invoice.balance_due)), 0);
    overdueCustomers = invoices.filter((invoice) => numeric(invoice.balance_due) > 0).length;

    const payments = paymentsResult.data ?? [];
    const todayPayments = payments.filter((payment) => {
      const value = String(payment.payment_date ?? payment.created_at ?? "");
      return value >= todayStartIso && value < tomorrowIso;
    });
    cashCollected = todayPayments.reduce((sum, payment) => sum + numeric(payment.amount_received), 0);
    paymentCount = todayPayments.length;

    const customers = customersResult.data ?? [];
    activeCustomers = customers.filter((customer) => customer.active !== false && customer.status !== "inactive").length;

    const products = productsResult.data ?? [];
    productsInCatalogue = products.filter((product) => product.active !== false).length;

    const balances = balancesResult.data ?? [];
    const availableByProduct = new Map<string, number>();
    for (const balance of balances) {
      const productId = String(balance.product_id ?? "");
      availableByProduct.set(productId, (availableByProduct.get(productId) ?? 0) + numeric(balance.available_quantity));
      quantityOnHand += numeric(balance.quantity_on_hand);
      stockValue += numeric(balance.total_inventory_value);
      if (numeric(balance.available_quantity) < 0 || String(balance.reorder_status ?? "").toLowerCase() !== "healthy") {
        stockAlerts += 1;
      }
    }
    for (const product of products) {
      if (product.active === false || product.track_inventory === false) continue;
      const reorderLevel = numeric(product.reorder_level);
      if (reorderLevel > 0 && (availableByProduct.get(String(product.id)) ?? 0) <= reorderLevel) {
        stockAlerts += 1;
      }
    }

    const workflows = (workflowResult.data ?? []) as {
      module_name: string;
      process_name: string;
      document_name: string | null;
      reference_number: string;
      record_payload: WorkflowPayload | null;
      created_at: string;
    }[];
    const todayWorkflowSales = workflows.filter((record) => {
      const createdDate = String(record.created_at ?? "").slice(0, 10);
      return record.module_name === "Sales" && createdDate === today;
    });
    if (todaySales <= 0 && todayWorkflowSales.length > 0) {
      todaySales = todayWorkflowSales.reduce((sum, record) => sum + workflowAmount(record.record_payload), 0);
      todayInvoiceCount = todayWorkflowSales.length;
    }
    grnsToday = workflows.filter((record) => record.module_name === "Purchasing" && record.process_name.includes("Goods Received") && String(record.created_at ?? "").slice(0, 10) === today).length;
    recentActivity = workflows.slice(0, 5).map((record) => ({
      time: new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(record.created_at)),
      module: record.module_name,
      title: `${record.process_name} ${record.reference_number}`,
      quickAction: record.module_name === "Sales" ? "Open sales" : record.module_name === "Purchasing" ? "Open purchases" : "Open record",
    }));

    const profitRows = (profitAllocationsResult.data ?? []) as ProfitAllocationRow[];
    todayProfit = profitForPeriod(profitRows, todayStartIso, tomorrowIso);
    weekProfit = profitForPeriod(profitRows, weekStartIso, tomorrowIso);
    annualProfit = profitForPeriod(profitRows, yearStartIso, tomorrowIso);
  }

  const profitPin = businessName.toLowerCase().includes("cymereg") ? "2027" : "2027";
  const profitPeriods = [
    { label: "Today", value: "today", amount: todayProfit, caption: profitCaption(todayProfit, "Today") },
    { label: "This week", value: "week", amount: weekProfit, caption: profitCaption(weekProfit, "This week") },
    { label: "This year", value: "year", amount: annualProfit, caption: profitCaption(annualProfit, "This year") },
  ];

  const attentionRows = [
    ["Invoices", todayInvoiceCount > 0 ? `${todayInvoiceCount} invoice${todayInvoiceCount === 1 ? "" : "s"} posted today` : "No invoices posted today", todayInvoiceCount > 0 ? "Live" : "Ready", todayInvoiceCount > 0 ? "View" : "Create", "/sales"],
    ["Stock receipts", grnsToday > 0 ? `${grnsToday} GRN${grnsToday === 1 ? "" : "s"} posted today` : "No GRNs posted today", grnsToday > 0 ? "Live" : "Ready", "Receive", "/purchases/goods-received"],
    ["Customers", activeCustomers > 0 ? `${activeCustomers} active customer${activeCustomers === 1 ? "" : "s"}` : "Customer list is empty", activeCustomers > 0 ? "Live" : "Setup", activeCustomers > 0 ? "View" : "Add", "/customers"],
    ["Reports", todayInvoiceCount > 0 || paymentCount > 0 ? "Daily report has live activity" : "Daily report is ready", "Download", "Export", "/api/exports?module=Reports&process=Daily%20Report&format=pdf"],
  ];

  const ownerSummary = [
    todayInvoiceCount > 0
      ? `${todayInvoiceCount} sale${todayInvoiceCount === 1 ? "" : "s"} posted today worth ${money(todaySales)}.`
      : "No sale has been posted today yet.",
    paymentCount > 0
      ? `${money(cashCollected)} has been collected today across ${paymentCount} receipt${paymentCount === 1 ? "" : "s"}.`
      : "No cash receipt has been posted today yet.",
    customersOwing > 0
      ? `${money(customersOwing)} is still owed by customers. Follow up ${overdueCustomers} open invoice${overdueCustomers === 1 ? "" : "s"}.`
      : "Customer follow-up list is clean.",
  ];

  return (
    <div className="pb-24">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <DashboardTile label="Today sales" value={money(todaySales)} caption={todayInvoiceCount > 0 ? `${todayInvoiceCount} posted today` : "No sale posted today"} icon={ShoppingCart} tone="blue" />
        <DashboardTile label="Cash collected" value={money(cashCollected)} caption={paymentCount > 0 ? `${paymentCount} receipt${paymentCount === 1 ? "" : "s"} today` : "No receipt posted today"} icon={Banknote} tone="green" />
        <DashboardTile label="Customers owing" value={money(customersOwing)} caption={customersOwing > 0 ? `${overdueCustomers} invoice${overdueCustomers === 1 ? "" : "s"} to follow up` : "Follow-up list is clean"} icon={CreditCard} tone="gold" />
        <DashboardTile label="Active customers" value={activeCustomers.toLocaleString("en-KE")} caption={activeCustomers > 0 ? "Customer list is active" : "Create the first customer"} icon={Users} tone="cyan" />
        <DashboardTile label="Stock alerts" value={stockAlerts.toLocaleString("en-KE")} caption={stockAlerts > 0 ? "Review reorder or negative stock" : "Stock position is clean"} icon={PackagePlus} tone="rose" />
        <ProfitPrivacyCard businessName={businessName} pin={profitPin} periods={profitPeriods} />
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
              <ProgressRow label="Invoices posted today" value={todayInvoiceCount} amount={money(todaySales)} />
              <ProgressRow label="Payments received" value={paymentCount} amount={money(cashCollected)} />
              <ProgressRow label="Open customer balances" value={overdueCustomers} amount={money(customersOwing)} />
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Inventory Summary"
          action={<Link href="/inventory" className="text-sm font-semibold text-[var(--solva-blue-700)]">Open stock</Link>}
        >
          <div className="grid gap-3">
            {[
              ["Products in catalogue", productsInCatalogue.toLocaleString("en-KE"), productsInCatalogue > 0 ? "Products are ready for purchasing and sales." : "Add products before selling or buying."],
              ["Quantity on hand", quantityOnHand.toLocaleString("en-KE", { maximumFractionDigits: 2 }), quantityOnHand > 0 ? "Opening stock and receipts are feeding this." : "Opening stock and receipts update this."],
              ["Low-stock items", stockAlerts.toLocaleString("en-KE"), stockAlerts > 0 ? "Some items need reorder attention." : "Reorder warnings will appear here."],
              ["Stock value", money(stockValue), stockValue > 0 ? "Based on current stock valuation." : "Valuation starts after stock is received."],
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
        <MetricCard label="Money collected today" value={money(cashCollected)} story={paymentCount > 0 ? "Updated from posted customer receipts." : "No receipts yet. Record the first payment when money lands."} />
        <MetricCard label="Money customers owe you" value={money(customersOwing)} story={customersOwing > 0 ? "Updated from open invoice balances." : "This stays clean until invoices are posted."} />
        <MetricCard label="Stock value" value={money(stockValue)} story={stockValue > 0 ? "Updated from current stock balances." : "Receive stock to begin tracking value and reorder needs."} />
        <MetricCard label="Tax status" value={taxToday > 0 ? `${money(taxToday)} VAT today` : "No open filing"} story={taxToday > 0 ? "Updated from tax charged on today's invoices." : "VAT reminders will appear before due dates."} tone="good" />
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
            {(recentActivity.length > 0 ? recentActivity : timelineFoundation.slice(0, 5)).map((event) => (
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
