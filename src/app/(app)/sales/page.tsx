import Link from "next/link";
import { salesSummary, salesWorkflows } from "@/lib/sales-data";

export default function SalesPage() {
  const cards = [
    ["Active customers", salesSummary.activeCustomers.toString()],
    ["Orders ready for delivery", salesSummary.approvedOrdersReadyForDelivery.toString()],
    ["Open invoices", salesSummary.openInvoices.toString()],
    ["Customer balance", salesSummary.customerBalance],
    ["Debtor ageing", salesSummary.debtorAgeing],
    ["Payments today", salesSummary.paymentsToday],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Sales</p>
          <h1 className="mt-1 text-3xl font-semibold">Customer Sales Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Customer, order, invoice, payment and return foundations are available so distribution can plan and confirm deliveries without creating a second sales engine.
          </p>
        </div>
        <Link href="/customers" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          View customers
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {salesWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
