import Link from "next/link";
import { distributionSummary, distributionWorkflows } from "@/lib/distribution-data";

export default function DistributionPage() {
  const cards = [
    ["Delivery value today", distributionSummary.deliveryValueToday],
    ["Completion rate", distributionSummary.completionRate],
    ["On-time delivery", distributionSummary.onTimeDeliveryRate],
    ["Collections received", distributionSummary.collectionsReceived],
    ["Unreconciled cash", distributionSummary.unreconciledCash],
    ["Failed deliveries", distributionSummary.failedDeliveries.toString()],
    ["Vehicle stock value", distributionSummary.vehicleStockValue],
    ["Crates outstanding", distributionSummary.cratesOutstanding],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Distribution</p>
          <h1 className="mt-1 text-3xl font-semibold">Delivery Operations Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Plan runs, load vehicles, dispatch drivers, confirm deliveries, capture proof, collect route payments, reconcile stock, cash, returns and crates. Empty values mean no delivery transactions have been posted yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/distribution/planning" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Plan deliveries
          </Link>
          <Link href="/distribution/mobile" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Driver workspace
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {distributionWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ["Manager operations", "Runs awaiting approval, vehicles loading, late runs, failed stops, collections, stock variances and cash variances are ready for real delivery records."],
          ["Distribution insights", "Insights are intentionally empty until delivery runs, stock movements, collections, returns and packaging ledgers provide real signals."],
          ["Vehicle stock", "Dispatch posts warehouse-to-vehicle stock movements; delivery confirmation posts vehicle stock-out according to the configured recognition point."],
          ["Route close controls", "Run closure waits for stops, vehicle return, stock, cash, proof, returns, crates, expenses, exceptions and approvals."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
