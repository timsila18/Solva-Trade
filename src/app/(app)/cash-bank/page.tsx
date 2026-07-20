import Link from "next/link";
import { treasurySummary, treasuryWorkflows } from "@/lib/treasury-data";

export default function CashBankPage() {
  const cards = [
    ["Total cash available", treasurySummary.totalCashAvailable],
    ["Bank balances", treasurySummary.bankBalances],
    ["M-Pesa balances", treasurySummary.mpesaBalances],
    ["Cash held by drivers", treasurySummary.cashHeldByDrivers],
    ["Cash in transit", treasurySummary.cashInTransit],
    ["Unidentified receipts", treasurySummary.unidentifiedReceipts.toString()],
    ["Unreconciled transactions", treasurySummary.unreconciledTransactions.toString()],
    ["Staff advances", treasurySummary.staffAdvancesOutstanding],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Cash & Bank</p>
          <h1 className="mt-1 text-3xl font-semibold">Treasury Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Manage cash accounts, bank accounts, M-Pesa, receipts, payments, expenses, deposits, withdrawals, transfers, owner transactions, staff advances, reconciliations and cashflow. Empty values mean no treasury transactions have been posted yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cash-bank/receipts" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Record receipt
          </Link>
          <Link href="/cash-bank/reconciliation" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Reconcile account
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
        {treasuryWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ["Treasury insights", "Insights stay empty until financial-account transactions, reconciliations, cash counts and statement imports provide real signals."],
          ["Ledger controls", "Account balances are derived from immutable financial-account transactions and can be rebuilt from the ledger."],
          ["Statement matching", "Bank and M-Pesa statement imports support suggested matches, partial matches, duplicate flags and unidentified receipts."],
          ["Cashflow forecast", "Forecasts use current invoices, expected route collections, supplier bills, transfers, expenses, owner funding and staff advances."],
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
