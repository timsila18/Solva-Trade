import Link from "next/link";
import {
  completionPercent,
  configurationStats,
  demoBranches,
  demoBusinesses,
  setupChecklist,
} from "@/lib/mock-data";

const ownerCards = [
  ["Active business", demoBusinesses[0].tradingName],
  ["Active branch", `${demoBranches[0].name} (${demoBranches[0].code})`],
  ["Active branches", configurationStats.activeBranches.toString()],
  ["Stock locations", configurationStats.stockLocations.toString()],
  ["Active users", configurationStats.activeUsers.toString()],
  ["Tax setup", configurationStats.taxSetupStatus],
  ["eTIMS/ETR setup", configurationStats.etimsStatus],
  ["Document numbering", configurationStats.documentNumberingStatus],
  ["Inventory value", "KES 0.00"],
  ["Low-stock count", "0"],
  ["Out-of-stock count", "0"],
  ["Near-expiry stock", "KES 0.00"],
  ["Supplier balance", "KES 0.00"],
  ["Open purchase orders", "0"],
  ["Supplier bills due", "KES 0.00"],
  ["Expected deliveries", "0"],
  ["Delivery value today", "KES 0.00"],
  ["Collections received", "KES 0.00"],
  ["Unreconciled cash", "KES 0.00"],
  ["Crates outstanding", "0"],
  ["Total cash position", "KES 0.00"],
  ["Unreconciled bank items", "0"],
  ["Unreconciled M-Pesa items", "0"],
  ["Staff advances overdue", "0"],
];

export default function DashboardPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Owner dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold">Business Command Centre</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Configure your business operating model before transactions are introduced. No fake sales, stock, purchase or profit values are shown.
          </p>
        </div>
        <Link href="/settings" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Open settings centre
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Business setup checklist</h2>
            <p className="text-sm text-slate-600">Critical and optional configuration now feed the Prompt 2 setup foundation.</p>
          </div>
          <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {completionPercent}%
          </span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {setupChecklist.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-3">
              <span className="text-sm font-medium">{item.label}</span>
              <span className={item.complete ? "text-sm text-emerald-700" : "text-sm text-slate-500"}>
                {item.complete ? "Done" : item.phase === "ready" ? "Action needed" : "Next phase"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ownerCards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <h3 className="mt-3 text-xl font-semibold">{value}</h3>
            <p className="mt-3 text-sm text-slate-600">Configuration foundation ready.</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          ["Important setup alerts", "Upload logo, configure credit settings, add first category and add first brand."],
          ["Recommended next setup actions", "Apply the beverage distributor preset, review delivery routes and enable returnable packaging."],
          ["Manager Operations Centre", "Assigned branch, warehouses and enabled operational features are ready for manager dashboards."],
          ["Staff My Work Today", "Active branch, permissions and operational template are prepared for staff-specific views."],
          ["Branch filters", "Dashboard placeholders are branch-aware and ready for transaction modules."],
          ["Audit activity", "Configuration actions are captured by immutable audit log structures."],
          ["Inventory recommendations", "Create products, post opening stock, configure reorder levels and run your first stock count."],
          ["Pending inventory approvals", "Transfers, adjustments, counts and cost revaluations will appear here when approval policies require review."],
          ["Purchasing recommendations", "Add suppliers, configure price lists, create purchase orders and post GRNs through the purchasing ledger."],
          ["Pending purchasing approvals", "Supplier approvals, requisitions, purchase orders, supplier bills and payments will appear here when review is required."],
          ["Distribution recommendations", "Plan delivery runs, verify loading, dispatch vehicles and close route reconciliations after real orders exist."],
          ["Distribution exceptions", "Failed deliveries, stock variances, cash shortfalls, proof gaps and packaging variances will appear from delivery records."],
          ["Treasury recommendations", "Create financial accounts, post opening balances, import statements and reconcile cash, bank and M-Pesa accounts."],
          ["Cash controls", "Large payments, owner drawings, cash variances, unreconciled items and overdue advances will appear from real treasury records."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-3 text-sm text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
