import Link from "next/link";
import { supplierRiskChecks, supplierTypes } from "@/lib/purchasing-data";

export default function SuppliersPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Suppliers</p>
          <h1 className="mt-1 text-3xl font-semibold">Supplier Master</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Maintain approved suppliers, contacts, branches, compliance documents, payment terms, product price lists and creditor opening balances.
          </p>
        </div>
        <Link href="/suppliers/new" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Add supplier
        </Link>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search by name, code, KRA PIN, phone or email" />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All types</option>
            {supplierTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending approval</option>
            <option value="hold">On hold</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All balances</option>
            <option value="overdue">Overdue</option>
            <option value="advance">Advance held</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Approved", "0"],
          ["Pending approval", "0"],
          ["On hold", "0"],
          ["Outstanding balance", "KES 0.00"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Supplier list</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-[1.2fr_120px_140px_140px_140px] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Supplier</span>
            <span>Type</span>
            <span>Status</span>
            <span>Balance</span>
            <span>Next action</span>
          </div>
          <div className="px-4 py-8 text-sm text-slate-600">No suppliers have been created yet.</div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Supplier risk checks</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {supplierRiskChecks.map((check) => (
              <div key={check} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{check}</div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Price management</h2>
          <p className="mt-2 text-sm text-slate-600">
            Product-supplier mappings store preferred supplier flags, pack conversion, lead time, minimum order quantity, price history and reapproval thresholds.
          </p>
        </article>
      </section>
    </div>
  );
}
