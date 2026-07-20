import { ShoppingCart } from "lucide-react";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { purchasingSummary, purchasingWorkflows } from "@/lib/purchasing-data";

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

export default function PurchasesPage() {
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
