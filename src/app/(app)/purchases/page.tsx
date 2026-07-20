import Link from "next/link";
import { purchasingSummary, purchasingWorkflows } from "@/lib/purchasing-data";

export default function PurchasesPage() {
  const cards = [
    ["Approved suppliers", purchasingSummary.approvedSuppliers.toString()],
    ["Pending supplier approvals", purchasingSummary.pendingSupplierApprovals.toString()],
    ["Open purchase orders", purchasingSummary.openPurchaseOrders.toString()],
    ["Expected receipts", purchasingSummary.expectedReceipts.toString()],
    ["Unmatched bills", purchasingSummary.unmatchedBills.toString()],
    ["Supplier balance", purchasingSummary.supplierBalance],
    ["Overdue supplier bills", purchasingSummary.overdueSupplierBills],
    ["Pending payments", purchasingSummary.pendingPayments],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Purchasing</p>
          <h1 className="mt-1 text-3xl font-semibold">Supplier & Purchasing Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Suppliers, requisitions, purchase orders, GRNs, supplier bills, returns, payments and creditor ageing share one purchasing ledger. Empty values mean no supplier transactions have been posted yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/suppliers/new" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Add supplier
          </Link>
          <Link href="/purchases/purchase-orders" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            New purchase order
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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search supplier, PO, GRN, invoice or payment reference" />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All suppliers</option>
            <option value="approved">Approved</option>
            <option value="hold">On hold</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="pending">Pending approval</option>
            <option value="matched">Matched</option>
            <option value="exception">Exception</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {purchasingWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ["Approval inbox", "Supplier approvals, requisitions, purchase orders, GRNs, bills, returns and payments will appear here when policies require review."],
          ["Three-way match exceptions", "Quantity, price, tax, missing GRN and overbilling exceptions are ready for ledger-backed supplier bills."],
          ["Expected deliveries", "Approved purchase orders with open quantities will populate delivery dates and receiving priorities."],
          ["Creditor controls", "Opening balances, immutable supplier transactions and ageing buckets are ready for posted bills and payments."],
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
