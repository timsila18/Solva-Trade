import Link from "next/link";
import { financialInsights, financialSummary, financialWorkflows } from "@/lib/financial-reporting-data";

export default function FinancialsPage() {
  const cards = [
    ["Revenue", financialSummary.revenueThisMonth],
    ["Gross profit", financialSummary.grossProfitThisMonth],
    ["Profit after expenses", financialSummary.netProfitThisMonth],
    ["Gross margin", financialSummary.grossMargin],
    ["Cash available", financialSummary.cashPosition],
    ["Money customers owe", financialSummary.customerReceivables],
    ["Money owed to suppliers", financialSummary.supplierPayables],
    ["Inventory value", financialSummary.inventoryValue],
    ["Working capital", financialSummary.workingCapital],
    ["Budget performance", financialSummary.budgetPerformance],
    ["Projected year-end profit", financialSummary.forecastYearEndProfit],
    ["Current ratio", financialSummary.currentRatio],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Financial performance</p>
          <h1 className="mt-1 text-3xl font-semibold">Statements and Management Accounts</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Generate Profit and Loss, Balance Sheet, Cash Flow, equity movements, budgets, forecasts, ratios, branch performance and period-close packs from posted accounting entries only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/financials/profit-and-loss" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Profit and Loss
          </Link>
          <Link href="/financials/period-close" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Period close
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
        {financialWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Financial insights</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {financialInsights.map((insight) => (
            <p key={insight} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">
              {insight}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
