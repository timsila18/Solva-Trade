import Link from "next/link";
import { Eye, FileText, Pencil, Phone, Search, Trash2, UserPlus } from "lucide-react";
import { deleteCustomerAction } from "@/app/(app)/actions";
import { EmptyState, MetricCard, PageHero } from "@/components/ui/premium";
import { customerSetupSections, salesSummary } from "@/lib/sales-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type CustomerRow = {
  id: string;
  customer_code: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  kra_pin: string | null;
  current_balance: number | string | null;
  credit_limit: number | string | null;
  default_payment_terms: string | null;
  active: boolean | null;
  status: string | null;
  customer_addresses?: { town: string | null; delivery_instructions: string | null; is_default: boolean | null }[] | null;
};

const setupLabels: Record<string, string> = {
  Identity: "Name and business type",
  Contacts: "Phone and email",
  Addresses: "Delivery places",
  "Route Assignment": "Delivery route",
  "Price Level": "Selling price group",
  "Credit Terms": "Payment agreement",
  "Tax Details": "KRA details",
  "Packaging Account": "Crates and returns",
};

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

function cleanTerm(value: string | null) {
  return (value || "Due immediately").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadCustomers() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
  if (!businessId) return [] as CustomerRow[];

  const { data } = await supabase
    .from("customers")
    .select("id, customer_code, customer_name, phone, email, kra_pin, current_balance, credit_limit, default_payment_terms, active, status, customer_addresses(town, delivery_instructions, is_default)")
    .eq("business_id", businessId)
    .eq("active", true)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as CustomerRow[];
}

export default async function CustomersPage() {
  const customers = await loadCustomers();
  const activeCount = customers.filter((customer) => customer.active !== false && customer.status !== "archived").length;
  const customerBalance = customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.current_balance ?? 0) || 0), 0);

  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Customers"
        title="Know every customer, what they buy, and what they owe."
        description="Keep phone numbers, delivery places, payment agreements and balances in one friendly customer book."
        primaryAction={{ label: "New Customer", href: "/customers/new", icon: UserPlus }}
        secondaryAction={{ label: "Record Payment", href: "/sales/payments" }}
        insight="Once customers start buying, I will point out who needs a follow-up and who is becoming overdue."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Customers saved"
          value={activeCount.toString()}
          story="Add customers once; use them everywhere."
        />
        <MetricCard
          label="Ready for delivery"
          value={salesSummary.approvedOrdersReadyForDelivery.toString()}
          story="Orders will show here before routes are planned."
        />
        <MetricCard
          label="Money customers owe you"
          value={money(customerBalance)}
          story="A plain balance you can follow up on."
        />
        <MetricCard
          label="Late customer money"
          value={salesSummary.debtorAgeing}
          story="Overdue balances will be highlighted here."
          tone="warning"
        />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-800">
            <Search className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">Find a customer instantly</h2>
            <p className="mt-1 text-sm text-slate-600">Search by name, phone, route, town or KRA PIN.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_170px_170px]">
          <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search customer, phone, route or town" />
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All routes</option>
          </select>
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All balances</option>
            <option value="overdue">Owes money</option>
            <option value="packaging">Crates owed</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="px-1 font-semibold">What Solva remembers</h2>
          <p className="px-1 pt-2 text-sm text-slate-600">Start simple. Add advanced details only when needed.</p>
          <div className="mt-3 grid gap-1">
            {customerSetupSections.map((section, index) => (
              <div key={section} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-slate-50">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700">{index + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{setupLabels[section] ?? section}</span>
                  <span className="text-xs text-slate-500">{section}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="font-semibold">Customer list</h2>
              <p className="mt-2 text-sm text-slate-600">Your saved customers will appear here with phone, balance and last purchase.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/customers/catalogue" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-[var(--solva-blue-700)]">
                <FileText className="h-4 w-4" />
                Catalogue / Price List
              </Link>
              <Link href="/customers/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                <Phone className="h-4 w-4" />
                Add by Phone
              </Link>
            </div>
          </div>
          {customers.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[1.4fr_0.8fr_1fr_0.9fr_0.85fr_0.85fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <span>Customer</span>
                  <span>Phone</span>
                  <span>Town / Route</span>
                  <span>Terms</span>
                  <span>Balance</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                {customers.map((customer) => {
                  const address = customer.customer_addresses?.find((item) => item.is_default) ?? customer.customer_addresses?.[0];
                  const route = address?.delivery_instructions?.replace(/^Preferred route:\s*/i, "") || "-";
                  return (
                    <div key={customer.id} className="grid grid-cols-[1.4fr_0.8fr_1fr_0.9fr_0.85fr_0.85fr_1fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                      <div>
                        <p className="font-semibold text-slate-950">{customer.customer_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{customer.customer_code ?? "No code"}{customer.kra_pin ? ` · ${customer.kra_pin}` : ""}</p>
                      </div>
                      <span className="text-slate-700">{customer.phone || "-"}</span>
                      <span className="text-slate-700">{[address?.town, route].filter((value) => value && value !== "-").join(" / ") || "-"}</span>
                      <span>{cleanTerm(customer.default_payment_terms)}</span>
                      <span className="font-semibold">{money(customer.current_balance)}</span>
                      <span className={`w-fit rounded-[4px] px-2 py-1 text-xs font-semibold ${customer.active !== false && customer.status !== "archived" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {customer.active !== false && customer.status !== "archived" ? "Active" : "Archived"}
                      </span>
                      <div className="flex justify-end gap-2">
                        <Link href={`/customers/${customer.id}/edit`} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border border-slate-300 px-3 text-xs font-semibold text-slate-700">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <Link href={`/api/exports?module=Customers&process=Customer%20Profile&format=pdf&customerId=${customer.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] bg-slate-950 px-3 text-xs font-semibold text-white">
                          <Eye className="h-3.5 w-3.5" />
                          PDF
                        </Link>
                        <details className="relative">
                          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-[6px] border border-red-200 px-3 text-xs font-semibold text-red-700 marker:hidden">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-red-100 bg-white p-3 text-left shadow-lg">
                            <p className="text-xs leading-5 text-slate-600">Remove this customer from active use. Past invoices and reports remain intact.</p>
                            <form action={deleteCustomerAction} className="mt-3">
                              <input type="hidden" name="customerId" value={customer.id} />
                              <button className="min-h-9 w-full rounded-md bg-red-600 px-3 text-xs font-semibold text-white">Confirm delete</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="You haven't added any customers yet."
                description="Customers help you track sales, balances, payments and delivery places without repeating details."
                action={{ label: "Add First Customer", href: "/customers/new" }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
