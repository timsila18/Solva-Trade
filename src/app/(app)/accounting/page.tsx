import Link from "next/link";
import { accountingInsights, accountingSummary, accountingWorkflows } from "@/lib/accounting-data";

export default function AccountingPage() {
  const cards = [
    ["Current period", accountingSummary.currentPeriod],
    ["Posted today", accountingSummary.postedToday.toString()],
    ["Awaiting approval", accountingSummary.awaitingApproval.toString()],
    ["Failed events", accountingSummary.failedEvents.toString()],
    ["Awaiting mapping", accountingSummary.awaitingMapping.toString()],
    ["Trial balance", accountingSummary.trialBalanceStatus],
    ["Customer control", accountingSummary.customerControlDifference],
    ["Inventory control", accountingSummary.inventoryControlDifference],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Accounting</p>
          <h1 className="mt-1 text-3xl font-semibold">General Ledger Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Configure the chart of accounts, post balanced accounting entries, control periods, reconcile subledgers and prepare clean data for financial statements. Zero values mean no posted journals exist yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/accounting/manual-journals" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            New journal
          </Link>
          <Link href="/accounting/trial-balance" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Trial balance
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
        {accountingWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Accounting insights</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {accountingInsights.map((insight) => (
            <p key={insight} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">
              {insight}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
