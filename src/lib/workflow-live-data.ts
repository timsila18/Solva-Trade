import "server-only";
import { createSupabaseServerClient, getSupabaseUser } from "@/lib/supabase/server";
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
  const activeBusinessId = await getActiveBusinessId();
  if (activeBusinessId) return activeBusinessId;
  const { data } = await getSupabaseUser();
  const user = data.user;
  return (
    (typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null)
  );
}

// Advance by returned rows, not requested size: deployments may have a smaller API row limit.
async function loadAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
  label: string,
) {
  const rows: T[] = [];
  let total: number | null = null;
  while (true) {
    const result = await queryPage(rows.length, rows.length + 999);
    if (result.error) throw new Error(`Could not load ${label}. ${result.error.message}`);
    if (typeof result.count === "number") total = result.count;
    if (!result.data?.length) return { data: rows };
    rows.push(...result.data);
    if (total !== null && rows.length >= total) return { data: rows };
  }
}

async function loadProductTaxes(
  admin: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const [rates, mappings, codes] = await Promise.all([
    loadAllRows((from, to) => admin.from("tax_rates").select("id, tax_code, rate", { count: from === 0 ? "exact" : undefined }).eq("business_id", businessId).eq("active", true)
      .lte("effective_start_date", today).or(`effective_end_date.is.null,effective_end_date.gte.${today}`).order("id", { ascending: true }).range(from, to), "product tax settings"),
    loadAllRows((from, to) => admin.from("product_tax_mappings").select("product_id, sales_vat_code_id", { count: from === 0 ? "exact" : undefined }).eq("business_id", businessId)
      .eq("active", true).not("product_id", "is", null).order("precedence", { ascending: true }).order("id", { ascending: true }).range(from, to), "product tax settings"),
    loadAllRows((from, to) => admin.from("vat_codes").select("id, business_id, vat_code, rate", { count: from === 0 ? "exact" : undefined }).or(`business_id.eq.${businessId},business_id.is.null`)
      .eq("active", true).order("effective_start_date", { ascending: false }).order("id", { ascending: true }).range(from, to), "product tax settings"),
  ]);
  const rateById = new Map((rates.data ?? []).map((rate) => [String(rate.id), rate]));
  const codeById = new Map((codes.data ?? []).map((code) => [String(code.id), code]));
  const mappingByProduct = new Map<string, string | null>();
  for (const mapping of mappings.data ?? []) {
    if (!mappingByProduct.has(String(mapping.product_id))) mappingByProduct.set(String(mapping.product_id), mapping.sales_vat_code_id);
  }
  const fallback = codes.data?.find((code) => code.business_id === businessId && code.vat_code === "VAT_STD")
    ?? codes.data?.find((code) => code.business_id === null && code.vat_code === "VAT_STD");
  return (product: { id: string; default_sales_tax_id: string | null; vat_status: string | null; tax_category: string | null }) => {
    const treatment = `${product.vat_status ?? product.tax_category ?? ""}`.toLowerCase();
    if (/(zero|exempt|out|none|no tax)/.test(treatment)) return { rate: 0, code: product.vat_status ?? product.tax_category ?? "NO_VAT" };
    const direct = rateById.get(product.default_sales_tax_id ?? "");
    if (direct) return { rate: Number(direct.rate ?? 0), code: String(direct.tax_code ?? "VAT_STD") };
    const mapped = codeById.get(mappingByProduct.get(product.id) ?? "");
    const resolved = mapped ?? fallback;
    return { rate: Number(resolved?.rate ?? 16), code: String(resolved?.vat_code ?? "VAT_STD") };
  };
}

export async function getSalesWorkflowLookups({ includeCustomers = true, includeInvoices = true }: { includeCustomers?: boolean; includeInvoices?: boolean } = {}): Promise<SalesWorkflowLookups> {
  const businessId = await currentBusinessId();
  if (!businessId) return { customers: [], products: [], unpaidInvoices: [], suppliers: [] };

  const admin = await createSupabaseServerClient();
  const balancesPromise = Promise.all([
    admin.from("branches").select("id").eq("business_id", businessId).eq("active", true).order("is_default", { ascending: false }).limit(1).maybeSingle(),
    admin
      .from("warehouses")
      .select("id")
      .eq("business_id", businessId)
      .eq("active", true)
      .eq("allow_sales_dispatch", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]).then(async ([{ data: branch }, { data: warehouse }]) => {
    return loadAllRows((from, to) => {
      let balanceQuery = admin.from("stock_balances").select("product_id, available_quantity", { count: from === 0 ? "exact" : undefined }).eq("business_id", businessId);
      if (branch?.id) balanceQuery = balanceQuery.eq("branch_id", branch.id);
      if (warehouse?.id) balanceQuery = balanceQuery.eq("warehouse_id", warehouse.id);
      return balanceQuery.order("product_id").order("id").range(from, to);
    }, "stock balances");
  });
  const [{ data: customers }, { data: products }, { data: balances }, { data: invoices }, { data: suppliers }, taxForProduct] = await Promise.all([
    includeCustomers ? loadAllRows((from, to) => admin
      .from("customers")
      .select("id, customer_name, customer_code, phone, current_balance", { count: from === 0 ? "exact" : undefined })
      .eq("business_id", businessId)
      .eq("active", true)
      .order("customer_name", { ascending: true }).order("id", { ascending: true }).range(from, to), "customers") : Promise.resolve({ data: [] }),
    loadAllRows((from, to) => admin
      .from("products")
      .select("id, product_name, product_code, sku, track_inventory, default_selling_price_placeholder, default_sales_tax_id, vat_status, tax_category", { count: from === 0 ? "exact" : undefined })
      .eq("business_id", businessId)
      .eq("active", true)
      .eq("archived", false)
      .order("product_name", { ascending: true }).order("id", { ascending: true }).range(from, to), "products"),
    balancesPromise,
    includeInvoices ? loadAllRows((from, to) => admin
      .from("sales_invoices")
      .select("id, invoice_number, customer_id, total_amount, balance_due, customers(customer_name)", { count: from === 0 ? "exact" : undefined })
      .eq("business_id", businessId)
      .gt("balance_due", 0)
      .in("status", ["posted", "partially_paid", "overdue"])
      .order("invoice_date", { ascending: false }).order("id", { ascending: true }).range(from, to), "sales_invoices") : Promise.resolve({ data: [] }),
    loadAllRows((from, to) => admin
      .from("suppliers")
      .select("id, legal_name, trading_name, supplier_code, primary_phone, supplier_type", { count: from === 0 ? "exact" : undefined })
      .eq("business_id", businessId)
      .in("status", ["approved", "draft", "pending_approval"])
      .order("legal_name", { ascending: true }).order("id", { ascending: true }).range(from, to), "suppliers"),
    loadProductTaxes(admin, businessId),
  ]);

  const stockByProduct = new Map<string, number>();
  for (const row of balances ?? []) {
    stockByProduct.set(String(row.product_id), (stockByProduct.get(String(row.product_id)) ?? 0) + Number(row.available_quantity ?? 0));
  }

  const productLookups = (products ?? []).map((product) => {
    const tax = taxForProduct({
      id: product.id,
      default_sales_tax_id: product.default_sales_tax_id,
      vat_status: product.vat_status,
      tax_category: product.tax_category,
    });
    return {
      id: String(product.id),
      name: String(product.product_name ?? product.sku ?? product.product_code ?? "Unnamed product"),
      code: String(product.sku ?? product.product_code ?? ""),
      price: Number(product.default_selling_price_placeholder ?? 0),
      available: stockByProduct.get(String(product.id)) ?? 0,
      vatRate: tax.rate,
      vatCode: tax.code,
      trackInventory: Boolean(product.track_inventory),
    };
  });

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
      id: String(supplier.id),
      name: String(supplier.trading_name || supplier.legal_name || "Unnamed supplier"),
      code: String(supplier.supplier_code ?? ""),
      phone: supplier.primary_phone ?? "",
      type: String(supplier.supplier_type ?? ""),
    })),
  };
}
