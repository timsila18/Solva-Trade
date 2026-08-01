import Link from "next/link";
import { CheckCircle2, FileText, PackageCheck, Printer, ShoppingCart } from "lucide-react";
import { reverseGoodsReceivedNoteAction, updateGoodsReceivedNoteDetailsAction } from "@/app/(app)/actions";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { purchasingSummary, purchasingWorkflows } from "@/lib/purchasing-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type GrnRow = {
  id: string;
  grn_number: string | null;
  receipt_date: string | null;
  supplier_delivery_note_number: string | null;
  status: string | null;
  posted_at: string | null;
  suppliers: { legal_name: string | null; trading_name: string | null; primary_phone: string | null } | { legal_name: string | null; trading_name: string | null; primary_phone: string | null }[] | null;
  goods_received_note_items:
    | { accepted_quantity: number | string | null; rejected_quantity: number | string | null; unit_cost: number | string | null }[]
    | null;
};

const cards = [
  ["Suppliers you buy from", purchasingSummary.approvedSuppliers.toString(), "Approved suppliers are ready for purchase orders and payments."],
  ["Suppliers waiting approval", purchasingSummary.pendingSupplierApprovals.toString(), "New suppliers stay here until reviewed."],
  ["Open purchase orders", purchasingSummary.openPurchaseOrders.toString(), "Goods expected from suppliers."],
  ["Expected deliveries", purchasingSummary.expectedReceipts.toString(), "Stock that should arrive soon."],
  ["Bills needing matching", purchasingSummary.unmatchedBills.toString(), "Supplier bills that need checking against received goods."],
  ["Money you owe suppliers", purchasingSummary.supplierBalance, "Plain view of supplier balances."],
  ["Late supplier bills", purchasingSummary.overdueSupplierBills, "Payments that may need attention."],
  ["Payments waiting", purchasingSummary.pendingPayments, "Supplier payments not yet completed."],
];

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value: number) {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function supplierName(grn: GrnRow) {
  const supplier = Array.isArray(grn.suppliers) ? grn.suppliers[0] : grn.suppliers;
  return supplier?.trading_name || supplier?.legal_name || "Supplier not recorded";
}

function grnStats(grn: GrnRow) {
  return (grn.goods_received_note_items ?? []).reduce(
    (summary, item) => {
      const accepted = asNumber(item.accepted_quantity);
      const rejected = asNumber(item.rejected_quantity);
      const cost = asNumber(item.unit_cost);
      return {
        accepted: summary.accepted + accepted,
        rejected: summary.rejected + rejected,
        value: summary.value + accepted * cost,
      };
    },
    { accepted: 0, rejected: 0, value: 0 },
  );
}

function grnDocumentHref(grn: GrnRow, format: "pdf" | "excel" | "print") {
  const stats = grnStats(grn);
  const params = new URLSearchParams({
    module: "Purchasing",
    process: "Goods Received Note (GRN)",
    format,
    grnId: grn.id,
    label_grn_number: "GRN number",
    field_grn_number: grn.grn_number || grn.id,
    label_supplier: "Supplier",
    field_supplier: supplierName(grn),
    label_received_date: "Received date",
    field_received_date: grn.receipt_date || "",
    label_supplier_delivery_note_number: "Supplier delivery note number",
    field_supplier_delivery_note_number: grn.supplier_delivery_note_number || "",
    label_accepted_quantity: "Accepted quantity",
    field_accepted_quantity: stats.accepted.toFixed(2),
    label_rejected_quantity: "Rejected quantity",
    field_rejected_quantity: stats.rejected.toFixed(2),
    label_total: "Total value",
    field_total: stats.value.toFixed(2),
  });
  return `/api/exports?${params.toString()}`;
}

async function recentGrns() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
    if (!businessId) return [];

    const { data, error } = await supabase
      .from("goods_received_notes")
      .select("id, grn_number, receipt_date, supplier_delivery_note_number, status, posted_at, suppliers(legal_name, trading_name, primary_phone), goods_received_note_items(accepted_quantity, rejected_quantity, unit_cost)")
      .eq("business_id", businessId)
      .order("receipt_date", { ascending: false })
      .limit(25);

    if (error) {
      console.warn("Could not load GRN history", error);
      return [];
    }
    return (data ?? []) as GrnRow[];
  } catch (error) {
    console.warn("GRN history skipped", error);
    return [];
  }
}

export default async function PurchasesPage() {
  const grns = await recentGrns();

  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Purchasing"
        title="Buy stock, receive goods, and know what you owe suppliers."
        description="Purchasing connects suppliers, purchase orders, goods received, bills and payments in one simple flow."
        primaryAction={{ label: "New Purchase Order", href: "/purchases/purchase-orders", icon: ShoppingCart }}
        secondaryAction={{ label: "Add Supplier", href: "/suppliers/new" }}
        insight="I will warn you when a supplier bill does not match the goods received, or when expected stock is late."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, story], index) => (
          <MetricCard key={label} label={label} value={value} story={story} tone={index === 1 || index === 4 || index === 6 ? "warning" : "neutral"} />
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Find supplier work quickly</h2>
        <p className="mt-2 text-sm text-slate-600">Search supplier, purchase order, goods receipt, invoice or payment reference.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_160px_180px]">
          <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search supplier, PO, invoice or payment" />
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All suppliers</option>
            <option value="approved">Approved</option>
            <option value="hold">On hold</option>
          </select>
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All statuses</option>
            <option value="pending">Needs approval</option>
            <option value="matched">Matched</option>
            <option value="exception">Needs checking</option>
          </select>
        </div>
      </section>

      <section id="grn-history" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-emerald-700">GRN History</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Goods received and stock documents</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Every posted stock receipt appears here with instant GRN PDF, Excel and print downloads from the saved receipt lines.
            </p>
          </div>
          <Link href="/purchases/goods-received" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
            <PackageCheck className="h-4 w-4" />
            Receive Goods
          </Link>
        </div>

        {grns.length ? (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
            {grns.map((grn) => {
              const stats = grnStats(grn);
              const status = String(grn.status ?? "posted").toLowerCase();
              const locked = status === "reversed" || status === "cancelled";
              return (
                <article key={grn.id} className="bg-white p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1.25fr] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{grn.grn_number || "GRN without number"}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${locked ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {grn.status || "posted"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{supplierName(grn)}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Received {grn.receipt_date || "not dated"} {grn.supplier_delivery_note_number ? `- supplier note ${grn.supplier_delivery_note_number}` : ""}
                      </p>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">Accepted</dt>
                        <dd className="mt-1 font-semibold text-slate-950">{stats.accepted.toLocaleString("en-KE", { maximumFractionDigits: 2 })}</dd>
                      </div>
                      <div className="rounded-md bg-rose-50 p-3">
                        <dt className="text-xs font-semibold text-rose-700">Rejected</dt>
                        <dd className="mt-1 font-semibold text-rose-950">{stats.rejected.toLocaleString("en-KE", { maximumFractionDigits: 2 })}</dd>
                      </div>
                      <div className="rounded-md bg-cyan-50 p-3">
                        <dt className="text-xs font-semibold text-cyan-700">Value</dt>
                        <dd className="mt-1 font-semibold text-cyan-950">{money(stats.value)}</dd>
                      </div>
                    </dl>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <a href={grnDocumentHref(grn, "pdf")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white">
                        <FileText className="h-4 w-4" />
                        PDF
                      </a>
                      <a href={grnDocumentHref(grn, "excel")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-[var(--solva-blue-700)]">
                        Excel
                      </a>
                      <a href={grnDocumentHref(grn, "print")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                        <Printer className="h-4 w-4" />
                        Print
                      </a>
                    </div>
                  </div>

                  <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Correct this GRN</summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <form action={updateGoodsReceivedNoteDetailsAction} className="rounded-md border border-slate-200 bg-white p-3">
                        <input type="hidden" name="grnId" value={grn.id} />
                        <h4 className="text-sm font-semibold text-slate-950">Update receipt details</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Use this for harmless corrections such as receiving date or supplier delivery note number.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Received date
                            <input name="receipt_date" type="date" defaultValue={grn.receipt_date ?? ""} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Supplier delivery note
                            <input name="supplier_delivery_note_number" defaultValue={grn.supplier_delivery_note_number ?? ""} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                          </label>
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-slate-600">
                          Correction note
                          <input name="reason" placeholder="Example: delivery note number corrected" className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                        </label>
                        <button className="mt-3 min-h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white">Update details</button>
                      </form>

                      <form action={reverseGoodsReceivedNoteAction} className="rounded-md border border-rose-200 bg-white p-3">
                        <input type="hidden" name="grnId" value={grn.id} />
                        <h4 className="text-sm font-semibold text-rose-950">Reverse stock receipt</h4>
                        <p className="mt-1 text-xs leading-5 text-rose-700">
                          Use this when product, quantity or unit cost was wrong. Stock is restored through a reversal movement, then receive the goods again correctly.
                        </p>
                        <label className="mt-3 block text-xs font-semibold text-slate-600">
                          Reason
                          <input name="reason" required disabled={locked} placeholder={locked ? "Already reversed or cancelled" : "Example: wrong unit cost entered"} className="mt-1 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
                        </label>
                        <button disabled={locked} className="mt-3 min-h-10 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                          Reverse GRN and restore stock
                        </button>
                      </form>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No GRNs have been posted yet"
              description="Once goods are received, the GRN history will show the supplier, accepted quantities, rejected quantities, value and download buttons."
              action={{ label: "Receive First Goods", href: "/purchases/goods-received" }}
            />
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {purchasingWorkflows.map((workflow) => (
          <PlainCard key={workflow.href} href={workflow.href} title={workflow.title} description={workflow.description} action="Open" />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="No supplier activity yet"
          description="Add a supplier and create the first purchase order to start tracking goods coming in and money owed."
          action={{ label: "Add First Supplier", href: "/suppliers/new" }}
        />
        <EmptyState
          title="No goods received yet"
          description="When stock arrives, receive it here so inventory value and supplier bills stay correct."
          action={{ label: "Receive Goods", href: "/purchases/goods-received" }}
        />
      </section>
    </div>
  );
}
