import Link from "next/link";
import { AlertTriangle, ArrowDownUp, Boxes, FileText, PackageCheck, PackagePlus, Search, TrendingDown, Warehouse } from "lucide-react";
import { DashboardTile, EmptyState, PageHero, PlainCard } from "@/components/ui/premium";
import { inventoryWorkflows } from "@/lib/inventory-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  product_name: string | null;
  product_code: string | null;
  sku: string | null;
  active: boolean | null;
  archived: boolean | null;
  track_inventory: boolean | null;
  reorder_level: number | string | null;
  default_selling_price_placeholder: number | string | null;
  standard_cost: number | string | null;
};

type BalanceRow = {
  product_id: string | null;
  quantity_on_hand: number | string | null;
  available_quantity: number | string | null;
  total_inventory_value: number | string | null;
  reorder_status: string | null;
};

type MovementRow = {
  id: string;
  product_id: string | null;
  movement_type: string | null;
  direction: string | null;
  quantity_base: number | string | null;
  total_cost: number | string | null;
  reference_number: string | null;
  movement_date: string | null;
  products: { product_name: string | null } | { product_name: string | null }[] | null;
};

type AlertRow = {
  id: string;
  title: string | null;
  alert_type: string | null;
  priority: string | null;
  created_at: string | null;
  products: { product_name: string | null } | { product_name: string | null }[] | null;
};

type InventoryDashboard = {
  activeProducts: number;
  trackableProducts: number;
  totalQuantity: number;
  availableQuantity: number;
  inventoryValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  activeAlerts: AlertRow[];
  recentMovements: MovementRow[];
  topValueProducts: { id: string; name: string; available: number; value: number; reorderLevel: number; status: string }[];
  productsWithoutStock: number;
};

function numeric(value: number | string | null | undefined) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value: number) {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactNumber(value: number) {
  return value.toLocaleString("en-KE", { maximumFractionDigits: 2 });
}

function productNameFromMovement(row: MovementRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return product?.product_name || "Product";
}

function productNameFromAlert(row: AlertRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return product?.product_name || "Inventory item";
}

async function loadInventoryDashboard(): Promise<InventoryDashboard> {
  const empty: InventoryDashboard = {
    activeProducts: 0,
    trackableProducts: 0,
    totalQuantity: 0,
    availableQuantity: 0,
    inventoryValue: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    activeAlerts: [],
    recentMovements: [],
    topValueProducts: [],
    productsWithoutStock: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
    if (!businessId) return empty;

    const [productsResult, balancesResult, alertsResult, movementsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, product_name, product_code, sku, active, archived, track_inventory, reorder_level, default_selling_price_placeholder, standard_cost")
        .eq("business_id", businessId)
        .order("product_name", { ascending: true })
        .limit(2000),
      supabase
        .from("stock_balances")
        .select("product_id, quantity_on_hand, available_quantity, total_inventory_value, reorder_status")
        .eq("business_id", businessId)
        .limit(5000),
      supabase
        .from("inventory_alerts")
        .select("id, title, alert_type, priority, created_at, products(product_name)")
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("stock_movements")
        .select("id, product_id, movement_type, direction, quantity_base, total_cost, reference_number, movement_date, products(product_name)")
        .eq("business_id", businessId)
        .order("movement_date", { ascending: false })
        .limit(8),
    ]);

    if (productsResult.error || balancesResult.error) return empty;

    const products = (productsResult.data ?? []) as ProductRow[];
    const balances = (balancesResult.data ?? []) as BalanceRow[];
    const activeProducts = products.filter((product) => product.active !== false && product.archived !== true);
    const trackableProducts = activeProducts.filter((product) => product.track_inventory !== false);
    const balancesByProduct = new Map<string, { quantity: number; available: number; value: number; status: string }>();

    for (const balance of balances) {
      const productId = String(balance.product_id ?? "");
      if (!productId) continue;
      const current = balancesByProduct.get(productId) ?? { quantity: 0, available: 0, value: 0, status: "healthy" };
      current.quantity += numeric(balance.quantity_on_hand);
      current.available += numeric(balance.available_quantity);
      current.value += numeric(balance.total_inventory_value);
      if (String(balance.reorder_status ?? "").toLowerCase() !== "healthy") current.status = String(balance.reorder_status ?? "attention");
      balancesByProduct.set(productId, current);
    }

    let totalQuantity = 0;
    let availableQuantity = 0;
    let inventoryValue = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;
    let productsWithoutStock = 0;
    const topValueProducts = trackableProducts.map((product) => {
      const balance = balancesByProduct.get(product.id) ?? { quantity: 0, available: 0, value: 0, status: "healthy" };
      const reorderLevel = numeric(product.reorder_level);
      totalQuantity += balance.quantity;
      availableQuantity += balance.available;
      inventoryValue += balance.value;
      if (balance.available <= 0) outOfStockProducts += 1;
      if (balance.available <= 0) productsWithoutStock += 1;
      if (reorderLevel > 0 && balance.available > 0 && balance.available <= reorderLevel) lowStockProducts += 1;
      return {
        id: product.id,
        name: product.product_name || product.sku || product.product_code || "Product",
        available: balance.available,
        value: balance.value,
        reorderLevel,
        status: balance.available <= 0 ? "Out" : reorderLevel > 0 && balance.available <= reorderLevel ? "Low" : balance.status,
      };
    })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return {
      activeProducts: activeProducts.length,
      trackableProducts: trackableProducts.length,
      totalQuantity,
      availableQuantity,
      inventoryValue,
      lowStockProducts,
      outOfStockProducts,
      productsWithoutStock,
      activeAlerts: ((alertsResult.data ?? []) as AlertRow[]) ?? [],
      recentMovements: ((movementsResult.data ?? []) as MovementRow[]) ?? [],
      topValueProducts,
    };
  } catch (error) {
    console.warn("Inventory dashboard skipped", error);
    return empty;
  }
}

function exportHref(process: string, format: "pdf" | "excel" | "print") {
  return `/api/exports?module=Inventory&process=${encodeURIComponent(process)}&format=${format}`;
}

export default async function InventoryPage() {
  const summary = await loadInventoryDashboard();
  const stockAlertCount = summary.lowStockProducts + summary.outOfStockProducts + summary.activeAlerts.length;

  const cards = [
    {
      label: "Products",
      value: summary.activeProducts.toString(),
      caption: `${summary.trackableProducts} track stock in this business`,
      icon: Boxes,
      tone: "blue" as const,
    },
    {
      label: "Stock on hand",
      value: compactNumber(summary.totalQuantity),
      caption: `${compactNumber(summary.availableQuantity)} available to sell`,
      icon: Warehouse,
      tone: "cyan" as const,
    },
    {
      label: "Stock value",
      value: money(summary.inventoryValue),
      caption: "Current value from live stock balances",
      icon: PackageCheck,
      tone: "green" as const,
    },
    {
      label: "Needs attention",
      value: stockAlertCount.toString(),
      caption: `${summary.lowStockProducts} low, ${summary.outOfStockProducts} out of stock`,
      icon: AlertTriangle,
      tone: stockAlertCount > 0 ? "rose" as const : "green" as const,
    },
    {
      label: "No stock",
      value: summary.productsWithoutStock.toString(),
      caption: "Trackable products currently at zero or below",
      icon: TrendingDown,
      tone: summary.productsWithoutStock > 0 ? "gold" as const : "green" as const,
    },
  ];

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

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <DashboardTile key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Live stock watch</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Highest value products</h2>
            </div>
            <Link href="/inventory/products" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700">
              Open products
            </Link>
          </div>
          {summary.topValueProducts.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                <span>Product</span>
                <span>Available</span>
                <span>Value</span>
                <span>Status</span>
              </div>
              {summary.topValueProducts.map((product) => (
                <article key={product.id} className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr] gap-3 border-t border-slate-200 px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-950">{product.name}</span>
                  <span>{compactNumber(product.available)}</span>
                  <span className="font-semibold">{money(product.value)}</span>
                  <span className={`rounded-full px-2 py-1 text-center text-xs font-black ${product.status === "Out" ? "bg-rose-100 text-rose-800" : product.status === "Low" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {product.status}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No stock balances yet" description="Receive stock or add opening stock to make this inventory watch come alive." action={{ label: "Receive Stock", href: "/purchases/goods-received" }} />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Recent movement</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Last stock actions</h2>
            </div>
            <ArrowDownUp className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {summary.recentMovements.length ? summary.recentMovements.map((movement) => (
              <article key={movement.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{productNameFromMovement(movement)}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                      {String(movement.movement_type ?? "movement").replaceAll("_", " ")} - {movement.reference_number || "No reference"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${movement.direction === "in" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {movement.direction === "in" ? "+" : "-"}{compactNumber(numeric(movement.quantity_base))}
                  </span>
                </div>
              </article>
            )) : (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No stock movements posted yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Find stock instantly</h2>
          <p className="mt-2 text-sm text-slate-600">Search by product, SKU, barcode, batch or movement reference.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_160px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 pl-10 text-sm" placeholder="Search products, SKU or barcode" />
            </label>
            <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
              <option value="all">All warehouses</option>
              <option value="main">Main Stock</option>
            </select>
            <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
              <option value="all">All stock levels</option>
              <option value="low">Running low</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Active inventory alerts</h2>
          <div className="mt-4 space-y-3">
            {summary.activeAlerts.length ? summary.activeAlerts.map((alert) => (
              <article key={alert.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">{alert.title || productNameFromAlert(alert)}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-amber-800">
                  {productNameFromAlert(alert)} - {String(alert.alert_type ?? "alert").replaceAll("_", " ")}
                </p>
              </article>
            )) : (
              <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">No active inventory alerts right now.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Product Master Report", "All products, prices, VAT treatment, stock and reorder settings."],
          ["Inventory Valuation Report", "Stock quantity, average cost and total value by product."],
          ["Reorder List", "Products that need buying attention now."],
        ].map(([name, description]) => (
          <article key={name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">One-click report</p>
            <h2 className="mt-1 font-semibold text-slate-950">{name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a href={exportHref(name, "pdf")} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-[var(--solva-blue-700)] px-2 text-xs font-semibold text-white">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </a>
              <a href={exportHref(name, "excel")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-2 text-xs font-semibold text-[var(--solva-blue-700)]">Excel</a>
              <a href={exportHref(name, "print")} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700">Print</a>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {inventoryWorkflows.map((workflow) => (
          <PlainCard key={workflow.href} href={workflow.href} title={workflow.title} description={workflow.description} action="Open" />
        ))}
      </section>
    </div>
  );
}
