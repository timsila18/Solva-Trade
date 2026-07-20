import Link from "next/link";
import { inventorySummary, inventoryWorkflows } from "@/lib/inventory-data";

export default function InventoryPage() {
  const cards = [
    ["Total active products", inventorySummary.activeProducts.toString()],
    ["Total stock quantity", inventorySummary.totalStockQuantity.toString()],
    ["Inventory value", inventorySummary.inventoryValue],
    ["Low-stock products", inventorySummary.lowStockProducts.toString()],
    ["Out-of-stock products", inventorySummary.outOfStockProducts.toString()],
    ["Near-expiry value", inventorySummary.nearExpiryValue],
    ["Expired-stock value", inventorySummary.expiredStockValue],
    ["Transfers in progress", inventorySummary.transfersInProgress.toString()],
  ];

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Inventory</p>
          <h1 className="mt-1 text-3xl font-semibold">Inventory Overview</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Products, stock balances, movements, batches, expiry, transfers, counts and valuation are powered by the stock ledger. Empty values mean no inventory has been posted yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inventory/products/new" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
            Add product
          </Link>
          <Link href="/inventory/opening-stock" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            Enter opening stock
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
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search products, SKU, barcode or movement reference" />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All warehouses</option>
            <option value="main">Main Stock Location</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All stock statuses</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="over">Overstocked</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {inventoryWorkflows.map((workflow) => (
          <Link key={workflow.href} href={workflow.href} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-300">
            <h2 className="font-semibold">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{workflow.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ["Recent movement timeline", "No stock movements have been posted yet."],
          ["Smart inventory insights", "Insights will appear from real stock balances, movements, batches and reorder settings."],
          ["Top-value products", "Valuation appears after opening stock or purchase receipts are posted."],
          ["Stock by branch and warehouse", "Branch and warehouse summaries are ready for ledger-backed data."],
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
