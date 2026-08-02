import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteSupplierAction } from "@/app/(app)/actions";
import { supplierRiskChecks, supplierTypes } from "@/lib/purchasing-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type SupplierRow = {
  id: string;
  supplier_type: string | null;
  legal_name: string;
  trading_name: string | null;
  supplier_code: string | null;
  kra_pin: string | null;
  primary_phone: string | null;
  email: string | null;
  default_payment_terms: string | null;
  credit_limit_granted: number | string | null;
  approved_supplier: boolean | null;
  on_hold: boolean | null;
  status: string | null;
  active: boolean | null;
  supplier_balances?: { current_balance: number | string | null; currency: string | null }[] | null;
};

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

function cleanLabel(value: string | null | undefined, fallback = "-") {
  const text = value?.trim();
  return text ? text.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback;
}

async function loadSuppliers() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
  if (!businessId) return [] as SupplierRow[];

  const { data } = await supabase
    .from("suppliers")
    .select("id, supplier_type, legal_name, trading_name, supplier_code, kra_pin, primary_phone, email, default_payment_terms, credit_limit_granted, approved_supplier, on_hold, status, active, supplier_balances(current_balance, currency)")
    .eq("business_id", businessId)
    .eq("active", true)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as SupplierRow[];
}

export default async function SuppliersPage() {
  const suppliers = await loadSuppliers();
  const approvedCount = suppliers.filter((supplier) => supplier.approved_supplier && !supplier.on_hold).length;
  const pendingCount = suppliers.filter((supplier) => supplier.status === "pending_approval" || supplier.status === "draft").length;
  const onHoldCount = suppliers.filter((supplier) => supplier.on_hold || supplier.status === "on_hold").length;
  const supplierBalance = suppliers.reduce((sum, supplier) => {
    const balances = supplier.supplier_balances ?? [];
    return sum + balances.reduce((inner, balance) => inner + Math.max(0, Number(balance.current_balance ?? 0) || 0), 0);
  }, 0);

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
          ["Approved", approvedCount.toString()],
          ["Pending approval", pendingCount.toString()],
          ["On hold", onHoldCount.toString()],
          ["Outstanding balance", money(supplierBalance)],
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
          <div className="grid grid-cols-[1.2fr_120px_140px_140px_170px] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Supplier</span>
            <span>Type</span>
            <span>Status</span>
            <span>Balance</span>
            <span>Next action</span>
          </div>
          {suppliers.length > 0 ? (
            suppliers.map((supplier) => {
              const balance = (supplier.supplier_balances ?? []).reduce((sum, row) => sum + (Number(row.current_balance ?? 0) || 0), 0);
              const displayName = supplier.trading_name || supplier.legal_name;
              return (
                <div key={supplier.id} className="grid grid-cols-[1.2fr_120px_140px_140px_170px] items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-950">{displayName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[supplier.supplier_code, supplier.primary_phone, supplier.kra_pin].filter(Boolean).join(" · ") || "No code"}
                    </p>
                  </div>
                  <span className="text-slate-700">{cleanLabel(supplier.supplier_type)}</span>
                  <span className={`w-fit rounded-[4px] px-2 py-1 text-xs font-semibold ${supplier.on_hold ? "bg-amber-50 text-amber-700" : supplier.approved_supplier ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {supplier.on_hold ? "On hold" : supplier.approved_supplier ? "Approved" : cleanLabel(supplier.status, "Draft")}
                  </span>
                  <span className="font-semibold">{money(balance)}</span>
                  <div className="flex justify-end gap-2">
                    <Link href={`/api/exports?module=Suppliers&process=Supplier%20Profile&format=pdf&supplierId=${supplier.id}`} className="inline-flex min-h-9 items-center justify-center rounded-[6px] bg-slate-950 px-3 text-xs font-semibold text-white">
                      PDF
                    </Link>
                    <details className="relative">
                      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-[6px] border border-red-200 px-3 text-xs font-semibold text-red-700 marker:hidden">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-red-100 bg-white p-3 text-left shadow-lg">
                        <p className="text-xs leading-5 text-slate-600">Remove this supplier from active use. Past GRNs and purchase records remain intact.</p>
                        <form action={deleteSupplierAction} className="mt-3">
                          <input type="hidden" name="supplierId" value={supplier.id} />
                          <button className="min-h-9 w-full rounded-md bg-red-600 px-3 text-xs font-semibold text-white">Confirm delete</button>
                        </form>
                      </div>
                    </details>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-sm text-slate-600">No suppliers have been created yet.</div>
          )}
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
