import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

export type CustomerLookup = {
  id: string;
  name: string;
  code: string;
  phone: string;
  balance: number;
};

export type ProductLookup = {
  id: string;
  name: string;
  code: string;
  price: number;
  available: number;
  vatRate: number;
  vatCode: string;
  trackInventory: boolean;
};

export type InvoiceLookup = {
  id: string;
  number: string;
  customerId: string | null;
  customerName: string;
  balanceDue: number;
  total: number;
};

export type SupplierLookup = {
  id: string;
  name: string;
  code: string;
  phone: string;
  type: string;
};

export type SalesWorkflowLookups = {
  customers: CustomerLookup[];
  products: ProductLookup[];
  unpaidInvoices: InvoiceLookup[];
  suppliers: SupplierLookup[];
};

async function currentBusinessId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return (
    (await getActiveBusinessId()) ||
    (typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null)
  );
}

async function vatRateForProduct(
  admin: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  product: { id: string; default_sales_tax_id: string | null; vat_status: string | null; tax_category: string | null },
) {
  const treatment = `${product.vat_status ?? product.tax_category ?? ""}`.toLowerCase();
  if (/(zero|exempt|out|none|no tax)/.test(treatment)) return { rate: 0, code: product.vat_status ?? product.tax_category ?? "NO_VAT" };

  if (product.default_sales_tax_id) {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("tax_rates")
      .select("tax_code, rate")
      .eq("id", product.default_sales_tax_id)
      .eq("active", true)
      .lte("effective_start_date", today)
      .or(`effective_end_date.is.null,effective_end_date.gte.${today}`)
      .maybeSingle();
    if (data) return { rate: Number(data.rate ?? 0), code: String(data.tax_code ?? "VAT_STD") };
  }

  const { data: mapping } = await admin
    .from("product_tax_mappings")
    .select("sales_vat_code_id")
    .eq("business_id", businessId)
    .eq("product_id", product.id)
    .eq("active", true)
    .order("precedence", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mapping?.sales_vat_code_id) {
    const { data } = await admin
      .from("vat_codes")
      .select("vat_code, rate")
      .eq("id", mapping.sales_vat_code_id)
      .eq("active", true)
      .maybeSingle();
    if (data) return { rate: Number(data.rate ?? 0), code: String(data.vat_code ?? "VAT_STD") };
  }

  const { data: businessVat } = await admin
    .from("vat_codes")
    .select("vat_code, rate")
    .eq("business_id", businessId)
    .eq("vat_code", "VAT_STD")
    .eq("active", true)
    .order("effective_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (businessVat) return { rate: Number(businessVat.rate ?? 0), code: String(businessVat.vat_code ?? "VAT_STD") };

  const { data: globalVat } = await admin
    .from("vat_codes")
    .select("vat_code, rate")
    .is("business_id", null)
    .eq("vat_code", "VAT_STD")
    .eq("active", true)
    .order("effective_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { rate: Number(globalVat?.rate ?? 16), code: String(globalVat?.vat_code ?? "VAT_STD") };
}

export async function getSalesWorkflowLookups(): Promise<SalesWorkflowLookups> {
  const businessId = await currentBusinessId();
  if (!businessId) return { customers: [], products: [], unpaidInvoices: [], suppliers: [] };

  const admin = await createSupabaseServerClient();
  const [{ data: customers }, { data: products }, { data: balances }, { data: invoices }, { data: suppliers }] = await Promise.all([
    admin
      .from("customers")
      .select("id, customer_name, customer_code, phone, current_balance")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("customer_name", { ascending: true })
      .limit(200),
    admin
      .from("products")
      .select("id, product_name, product_code, sku, track_inventory, default_selling_price_placeholder, default_sales_tax_id, vat_status, tax_category")
      .eq("business_id", businessId)
      .eq("active", true)
      .eq("archived", false)
      .order("product_name", { ascending: true })
      .limit(300),
    admin.from("stock_balances").select("product_id, available_quantity").eq("business_id", businessId),
    admin
      .from("sales_invoices")
      .select("id, invoice_number, customer_id, total_amount, balance_due, customers(customer_name)")
      .eq("business_id", businessId)
      .gt("balance_due", 0)
      .in("status", ["posted", "partially_paid", "overdue"])
      .order("invoice_date", { ascending: false })
      .limit(200),
    admin
      .from("suppliers")
      .select("id, legal_name, trading_name, supplier_code, primary_phone, supplier_type")
      .eq("business_id", businessId)
      .in("status", ["approved", "draft", "pending_approval"])
      .order("legal_name", { ascending: true })
      .limit(200),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const row of balances ?? []) {
    stockByProduct.set(String(row.product_id), (stockByProduct.get(String(row.product_id)) ?? 0) + Number(row.available_quantity ?? 0));
  }

  const productLookups = await Promise.all(
    (products ?? []).map(async (product) => {
      const tax = await vatRateForProduct(admin, businessId, {
        id: product.id,
        default_sales_tax_id: product.default_sales_tax_id,
        vat_status: product.vat_status,
        tax_category: product.tax_category,
      });
      return {
        id: product.id,
        name: product.product_name,
        code: product.sku ?? product.product_code,
        price: Number(product.default_selling_price_placeholder ?? 0),
        available: stockByProduct.get(product.id) ?? 0,
        vatRate: tax.rate,
        vatCode: tax.code,
        trackInventory: Boolean(product.track_inventory),
      };
    }),
  );

  return {
    customers: (customers ?? []).map((customer) => ({
      id: customer.id,
      name: customer.customer_name,
      code: customer.customer_code,
      phone: customer.phone ?? "",
      balance: Number(customer.current_balance ?? 0),
    })),
    products: productLookups,
    unpaidInvoices: (invoices ?? []).map((invoice) => {
      const customerRecord = invoice.customers as { customer_name?: string } | { customer_name?: string }[] | null;
      return {
        id: invoice.id,
        number: invoice.invoice_number,
        customerId: invoice.customer_id,
        customerName: Array.isArray(customerRecord)
          ? String(customerRecord[0]?.customer_name ?? "")
          : String(customerRecord?.customer_name ?? ""),
        balanceDue: Number(invoice.balance_due ?? 0),
        total: Number(invoice.total_amount ?? 0),
      };
    }),
    suppliers: (suppliers ?? []).map((supplier) => ({
      id: supplier.id,
      name: supplier.trading_name || supplier.legal_name,
      code: supplier.supplier_code,
      phone: supplier.primary_phone ?? "",
      type: supplier.supplier_type,
    })),
  };
}
