import { CustomerCatalogueForm } from "@/components/app/customer-catalogue-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type CustomerOption = {
  id: string;
  customer_name: string;
  customer_code: string | null;
  phone: string | null;
};

type ProductOption = {
  id: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  default_selling_price_placeholder: number | string | null;
  vat_status: string | null;
  tax_category: string | null;
  active: boolean | null;
};

async function loadCatalogueData() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
  if (!businessId) return { customers: [] as CustomerOption[], products: [] as ProductOption[] };

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_name, customer_code, phone")
      .eq("business_id", businessId)
      .eq("active", true)
      .neq("status", "archived")
      .order("customer_name", { ascending: true })
      .limit(300),
    supabase
      .from("products")
      .select("id, product_name, product_code, sku, default_selling_price_placeholder, vat_status, tax_category, active")
      .eq("business_id", businessId)
      .eq("active", true)
      .eq("archived", false)
      .order("product_name", { ascending: true })
      .limit(500),
  ]);

  return {
    customers: (customers ?? []) as CustomerOption[],
    products: (products ?? []) as ProductOption[],
  };
}

export default async function CustomerCataloguePage() {
  const { customers, products } = await loadCatalogueData();

  return <CustomerCatalogueForm customers={customers} products={products} />;
}
