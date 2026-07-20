import { customerSetupSections, salesSummary } from "@/lib/sales-data";

export default function CustomersPage() {
  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Customers</p>
      <h1 className="mt-1 text-3xl font-semibold">Customer Master</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Maintain customers, route assignments, delivery addresses, payment terms, price levels, credit controls and packaging balances.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active customers", salesSummary.activeCustomers.toString()],
          ["Ready for delivery", salesSummary.approvedOrdersReadyForDelivery.toString()],
          ["Customer balance", salesSummary.customerBalance],
          ["Debtor ageing", salesSummary.debtorAgeing],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_170px_170px_170px]">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search customer, phone, KRA PIN, route or town" />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All routes</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="hold">On hold</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All balances</option>
            <option value="overdue">Overdue</option>
            <option value="packaging">Packaging owed</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          {customerSetupSections.map((section, index) => (
            <div key={section} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-xs font-semibold text-emerald-800">{index + 1}</span>
              <span className="text-sm font-medium">{section}</span>
            </div>
          ))}
        </aside>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Customer list</h2>
          <p className="mt-3 text-sm text-slate-600">No customers have been created yet.</p>
        </div>
      </section>
    </div>
  );
}
