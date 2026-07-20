import { Phone, Search, UserPlus } from "lucide-react";
import { EmptyState, MetricCard, PageHero } from "@/components/ui/premium";
import { customerSetupSections, salesSummary } from "@/lib/sales-data";

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

export default function CustomersPage() {
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
          value={salesSummary.activeCustomers.toString()}
          story="Add customers once; use them everywhere."
        />
        <MetricCard
          label="Ready for delivery"
          value={salesSummary.approvedOrdersReadyForDelivery.toString()}
          story="Orders will show here before routes are planned."
        />
        <MetricCard
          label="Money customers owe you"
          value={salesSummary.customerBalance}
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
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              <Phone className="h-4 w-4" />
              Add by Phone
            </button>
          </div>
          <div className="mt-5">
            <EmptyState
              title="You haven't added any customers yet."
              description="Customers help you track sales, balances, payments and delivery places without repeating details."
              action={{ label: "Add First Customer", href: "/customers/new" }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
