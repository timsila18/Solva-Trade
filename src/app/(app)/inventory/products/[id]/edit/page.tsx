import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductSetupForm, type ProductSetupDefaults } from "@/components/app/product-setup-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

function moneyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function productTypeLabel(value: string | null) {
  const map: Record<string, string> = {
    stock_item: "Stock Item",
    service: "Service",
    non_stock_item: "Non-Stock Item",
    returnable_packaging: "Returnable Packaging",
    raw_material: "Raw Material",
    finished_good: "Finished Good",
    consumable: "Consumable",
    expense_item: "Expense Item",
    other: "Other",
  };
  return map[value ?? ""] ?? "Stock Item";
}

async function lookupName(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: "product_categories" | "brands" | "units_of_measure",
  id: string | null,
) {
  if (!id) return "";
  const columns = {
    product_categories: "category_name",
    brands: "brand_name",
    units_of_measure: "name",
  }[table];
  const { data } = await supabase.from(table).select(columns).eq("id", id).maybeSingle();
  return data ? String((data as unknown as Record<string, unknown>)[columns] ?? "") : "";
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
  if (!businessId) notFound();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();

  if (!product) notFound();

  const { data: pack } = await supabase
    .from("product_pack_units")
    .select("conversion_factor, barcode, sku, from_unit_id, to_unit_id")
    .eq("business_id", businessId)
    .eq("product_id", id)
    .eq("default_purchase_unit", true)
    .eq("active", true)
    .maybeSingle();

  const [
    category,
    brand,
    baseUnit,
    purchaseUnit,
    sellingUnit,
    packFromUnit,
  ] = await Promise.all([
    lookupName(supabase, "product_categories", product.category_id),
    lookupName(supabase, "brands", product.brand_id),
    lookupName(supabase, "units_of_measure", product.base_unit_id),
    lookupName(supabase, "units_of_measure", product.purchase_unit_id),
    lookupName(supabase, "units_of_measure", product.selling_unit_id),
    lookupName(supabase, "units_of_measure", pack?.from_unit_id ?? null),
  ]);

  const defaults: ProductSetupDefaults = {
    id,
    product_name: product.product_name,
    brand,
    category,
    product_type: productTypeLabel(product.product_type),
    base_stock_unit: baseUnit || "Bottle",
    barcode: product.barcode,
    selling_price_placeholder: moneyValue(product.default_selling_price_placeholder),
    vat_treatment: product.vat_status || "VAT_STD",
    purchase_unit: purchaseUnit || packFromUnit || "Crate",
    selling_unit: sellingUnit || baseUnit || "Bottle",
    units_per_purchase_pack: moneyValue(pack?.conversion_factor),
    pack_barcode: pack?.barcode ?? "",
    pack_sku: pack?.sku ?? "",
    standard_cost: moneyValue(product.standard_cost),
    minimum_selling_price: moneyValue(product.minimum_selling_price),
    reorder_level: moneyValue(product.reorder_level),
    reorder_quantity: moneyValue(product.reorder_quantity),
    maximum_stock_level: moneyValue(product.maximum_stock_level),
    lead_time_days: moneyValue(product.lead_time_days),
    track_batches: product.track_batches,
    track_expiry: product.track_expiry,
    track_serial_numbers: product.track_serial_numbers,
    track_returnable_packaging: product.track_returnable_packaging,
    shelf_life_days: moneyValue(product.shelf_life_days),
    manufacturer: product.manufacturer,
    product_code: product.product_code,
    sku: product.sku,
    short_name: product.short_name,
    description: product.description,
    product_image_url: product.image_path,
    weight: moneyValue(product.weight),
    volume: moneyValue(product.volume),
    product_status: product.active ? "Active" : "Inactive",
  };

  return (
    <div className="pb-20">
      <div className="border-b border-slate-200 bg-white px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Inventory control</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Edit product</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Update the saved product details used by sales, purchasing, stock alerts, inventory reports and document exports.
        </p>
        <Link href="/inventory/products" className="mt-4 inline-flex min-h-10 items-center rounded-[6px] border border-slate-300 px-4 text-sm font-semibold text-slate-700">
          Back to products
        </Link>
      </div>
      <ProductSetupForm mode="edit" defaults={defaults} />
    </div>
  );
}
