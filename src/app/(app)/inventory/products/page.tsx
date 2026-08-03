import Link from "next/link";
import { Download, Eye, PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { deleteProductAction } from "@/app/(app)/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type ProductRow = {
  id: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  product_type: string | null;
  active: boolean | null;
  default_selling_price_placeholder: number | string | null;
  standard_cost: number | string | null;
  product_categories?: { category_name: string | null }[] | { category_name: string | null } | null;
  brands?: { brand_name: string | null }[] | { brand_name: string | null } | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(value);
}

function titleCase(value: string | null) {
  return (value ?? "Stock item").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relationName<T extends Record<string, string | null>>(value: T[] | T | null | undefined, key: keyof T) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.[key] || "-";
}

function searchText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function matchesProductSearch(product: ProductRow, query: string) {
  if (!query) return true;
  const haystack = [
    product.product_name,
    product.product_code,
    product.sku,
    product.barcode,
    product.product_type,
    relationName(product.product_categories, "category_name"),
    relationName(product.brands, "brand_name"),
  ].map(searchText).join(" ");
  return haystack.includes(query);
}

async function loadProducts() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);

  if (!businessId) return { products: [] as ProductRow[], balances: new Map<string, { quantity: number; value: number }>() };

  const [{ data: products }, { data: balances }] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_name, product_code, sku, barcode, product_type, active, default_selling_price_placeholder, standard_cost, product_categories(category_name), brands(brand_name)")
      .eq("business_id", businessId)
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
    supabase
      .from("stock_balances")
      .select("product_id, available_quantity, total_inventory_value")
      .eq("business_id", businessId),
  ]);

  const balanceMap = new Map<string, { quantity: number; value: number }>();
  for (const row of balances ?? []) {
    const productId = String(row.product_id ?? "");
    if (!productId) continue;
    const current = balanceMap.get(productId) ?? { quantity: 0, value: 0 };
    current.quantity += Number(row.available_quantity ?? 0);
    current.value += Number(row.total_inventory_value ?? 0);
    balanceMap.set(productId, current);
  }

  return { products: (products ?? []) as unknown as ProductRow[], balances: balanceMap };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = searchText(Array.isArray(params.q) ? params.q[0] : params.q).trim();
  const { products: allProducts, balances } = await loadProducts();
  const products = allProducts.filter((product) => matchesProductSearch(product, query));
  const filters = ["Category", "Brand", "Product type", "Stock status", "Branch", "Warehouse", "Active", "Batch tracked", "Expiry tracked"];

  return (
    <div className="pb-20">
      <div className="border-b border-slate-200 bg-white px-5 py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Inventory control</p>
            <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Products</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage stock items, services, returnable packaging, variants, SKUs, barcodes, units, reorder levels and inventory tracking settings.
            </p>
          </div>
          <Link href="/inventory/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-[var(--solva-blue-700)] px-4 py-2.5 text-sm font-semibold text-white">
            <PackagePlus className="h-4 w-4" />
            Add product
          </Link>
        </div>
      </div>

      <section className="mt-5 border border-slate-200 bg-white p-4">
        <form className="relative block" action="/inventory/products">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={query} className="min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2 pl-10 text-sm" placeholder="Search by product, SKU, barcode, category or brand" />
          <button className="sr-only">Search</button>
        </form>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filters.map((filter) => (
            <select key={filter} className="min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
              <option value="all">{filter}: All</option>
            </select>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-x-auto border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[1.5fr_0.85fr_0.95fr_1fr_1fr_0.85fr_0.9fr_0.75fr_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <span>Product</span>
            <span>SKU</span>
            <span>Barcode</span>
            <span>Category</span>
            <span>Brand</span>
            <span>Available</span>
            <span>Value</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {products.length > 0 ? (
            products.map((product) => {
              const balance = balances.get(product.id) ?? { quantity: 0, value: 0 };
              return (
                <div key={product.id} className="grid grid-cols-[1.5fr_0.85fr_0.95fr_1fr_1fr_0.85fr_0.9fr_0.75fr_1fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                  <div>
                    <p className="font-semibold text-slate-950">{product.product_name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{product.product_code ?? titleCase(product.product_type)}</p>
                  </div>
                  <span className="text-slate-700">{product.sku || "-"}</span>
                  <span className="text-slate-700">{product.barcode || "-"}</span>
                  <span>{relationName(product.product_categories, "category_name")}</span>
                  <span>{relationName(product.brands, "brand_name")}</span>
                  <span className="font-semibold">{balance.quantity.toLocaleString("en-KE")}</span>
                  <span>{money(balance.value)}</span>
                  <span className={`w-fit rounded-[4px] px-2 py-1 text-xs font-semibold ${product.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {product.active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex justify-end gap-2">
                    <Link href={`/inventory/products/${product.id}/edit`} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border border-slate-300 px-3 text-xs font-semibold text-slate-700">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <Link href={`/api/exports?module=Inventory&process=Product%20Profile&format=pdf&productId=${product.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] bg-slate-950 px-3 text-xs font-semibold text-white">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Link>
                    <details className="relative">
                      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-[6px] border border-red-200 px-3 text-xs font-semibold text-red-700 marker:hidden">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-red-100 bg-white p-3 text-left shadow-lg">
                        <p className="text-xs leading-5 text-slate-600">Remove this product from active use. Past sales, GRNs and reports remain intact.</p>
                        <form action={deleteProductAction} className="mt-3">
                          <input type="hidden" name="productId" value={product.id} />
                          <button className="min-h-9 w-full rounded-md bg-red-600 px-3 text-xs font-semibold text-white">Confirm delete</button>
                        </form>
                      </div>
                    </details>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-12 text-center">
              <h2 className="text-lg font-semibold">No products yet</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Add Coke 500ml, set the selling unit, VAT treatment, reorder level and source-cost controls. Stock value will only appear after receiving stock.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/inventory/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] bg-[var(--solva-blue-700)] px-4 py-2 text-sm font-semibold text-white">
                  <PackagePlus className="h-4 w-4" />
                  Create product
                </Link>
                <Link href="/api/exports?module=Inventory&process=Products%20import%20template&format=excel" className="inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 px-4 py-2 text-sm font-semibold">
                  <Download className="h-4 w-4" />
                  Import template
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
