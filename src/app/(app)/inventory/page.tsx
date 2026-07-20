import { PackagePlus } from "lucide-react";
import { EmptyState, MetricCard, PageHero, PlainCard } from "@/components/ui/premium";
import { inventorySummary, inventoryWorkflows } from "@/lib/inventory-data";

const cards = [
  ["Products you sell", inventorySummary.activeProducts.toString(), "Add products once, then track buying, selling and stock."],
  ["Items in stock", inventorySummary.totalStockQuantity.toString(), "Stock appears after opening stock, purchases or transfers."],
  ["Stock value", inventorySummary.inventoryValue, "This tells you how much money is sitting in goods."],
  ["Low-stock products", inventorySummary.lowStockProducts.toString(), "Solva will point out what may run out soon."],
  ["Out of stock", inventorySummary.outOfStockProducts.toString(), "Products needing urgent reorder show here."],
  ["Expiry risk", inventorySummary.nearExpiryValue, "Near-expiry stock is highlighted before it becomes a loss."],
  ["Expired stock", inventorySummary.expiredStockValue, "Expired value stays separate so it cannot hide in normal stock."],
  ["Transfers moving", inventorySummary.transfersInProgress.toString(), "Branch and warehouse moves are tracked until received."],
];

export default function InventoryPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Inventory"
        title="Know what you have, what is running out, and what needs reordering."
        description="Products, stock, batches, expiry and transfers stay simple on the surface, with detailed controls available when needed."
        primaryAction={{ label: "Receive Stock", href: "/purchases/goods-received", icon: PackagePlus }}
        secondaryAction={{ label: "Add Product", href: "/inventory/products/new" }}
        insight="I will warn you when fast-moving items are about to run out or when stock is sitting too long."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, story], index) => (
          <MetricCard key={label} label={label} value={value} story={story} tone={index === 3 || index === 4 ? "warning" : "neutral"} />
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Find stock instantly</h2>
        <p className="mt-2 text-sm text-slate-600">Search by product, SKU, barcode, batch or movement reference.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_160px_180px]">
          <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search products, SKU or barcode" />
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All warehouses</option>
            <option value="main">Main Stock</option>
          </select>
          <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All stock levels</option>
            <option value="low">Running low</option>
            <option value="out">Out of stock</option>
            <option value="over">Too much stock</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {inventoryWorkflows.map((workflow) => (
          <PlainCard key={workflow.href} href={workflow.href} title={workflow.title} description={workflow.description} action="Open" />
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="No stock has been added yet"
          description="Receive stock or enter opening balances so Solva can track value, low stock and reorder timing."
          action={{ label: "Receive First Stock", href: "/purchases/goods-received" }}
        />
        <EmptyState
          title="No product list yet"
          description="Products are the foundation for sales, purchasing, stock counts and profit tracking."
          action={{ label: "Add First Product", href: "/inventory/products/new" }}
        />
      </section>
    </div>
  );
}
