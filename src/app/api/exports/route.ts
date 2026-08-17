import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getActiveBusinessId } from "@/lib/tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportLine = {
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: string;
  taxAmount: number;
  lineTotal: number;
  warehouse: string;
  batch: string;
  notes: string;
  details?: Record<string, string>;
};

type Report = {
  moduleName: string;
  processName: string;
  partyName: string;
  businessName: string;
  businessLogoPath: string | null;
  businessPhone: string;
  businessEmail: string;
  businessLocation: string;
  paymentInstructions: string[];
  kraPin: string;
  generatedBy: string;
  generatedByRole: string;
  generatedAt: string;
  transaction: Record<string, string>;
  lines: ReportLine[];
  totals: Record<string, string>;
  approvals: Record<string, string>;
  auditTrail: string[];
};

type PaymentDetails = {
  payment_display_name?: string;
  paybill_number?: string;
  paybill_account_number?: string;
  till_number?: string;
  pochi_la_biashara_phone?: string;
  send_money_phone?: string;
  cheque_payee?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  bank_name?: string;
  bank_account_name?: string;
};

type PdfImageResource = {
  name: string;
  data: Buffer;
  width: number;
  height: number;
};

type DocumentTemplate =
  | "salesReceipt"
  | "taxInvoice"
  | "simplifiedInvoice"
  | "proformaInvoice"
  | "quotation"
  | "grn"
  | "purchaseOrder"
  | "statement"
  | "deliveryNote"
  | "dispatchNote"
  | "creditNote"
  | "debitNote"
  | "cashbook"
  | "paymentVoucher"
  | "stockMovement"
  | "inventoryReport"
  | "executiveReport"
  | "finance"
  | "report";

type DocumentBlueprint = {
  accent: string;
  soft: string;
  label: string;
  table: string;
  intro: [string, string, string][];
  headers: string[];
  signatures: string[];
  footerNote: string;
  emphasis: "receipt" | "invoice" | "operations" | "ledger" | "report" | "control";
};

const brand = {
  navy: "#071A2B",
  blue: "#1455D9",
  cyan: "#18B7C9",
  gold: "#D8A43B",
  slate: "#475569",
  muted: "#64748B",
  surface: "#EEF6FF",
  soft: "#F8FBFF",
  border: "#D8E2EE",
};

const pdfColors: Record<string, string> = {
  navy: "0.027 0.102 0.169",
  blue: "0.078 0.333 0.851",
  cyan: "0.094 0.718 0.788",
  gold: "0.847 0.643 0.231",
  slate: "0.278 0.333 0.411",
  muted: "0.392 0.455 0.545",
  border: "0.847 0.886 0.933",
  soft: "0.973 0.984 1",
  surface: "0.933 0.965 1",
  white: "1 1 1",
  black: "0 0 0",
  watermark: "0.89 0.96 0.98",
};

function csvSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function money(value: number) {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paymentDetailsFromJson(value: unknown): PaymentDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, item]) => typeof item === "string" && item.trim())
      .map(([key, item]) => [key, String(item).trim()]),
  ) as PaymentDetails;
}

function paymentInstructions(details: PaymentDetails, businessName: string, fallbackPhone: string) {
  const lines: string[] = [];
  const displayName = details.payment_display_name || businessName;
  if (details.paybill_number) {
    lines.push(`M-Pesa Paybill ${details.paybill_number}${details.paybill_account_number ? `, Account ${details.paybill_account_number}` : ""} - ${displayName}`);
  }
  if (details.till_number) lines.push(`M-Pesa Till ${details.till_number} - ${displayName}`);
  if (details.pochi_la_biashara_phone) lines.push(`Pochi la Biashara: ${details.pochi_la_biashara_phone} - ${displayName}`);
  if (details.send_money_phone) lines.push(`Send Money: ${details.send_money_phone} - ${displayName}`);
  if (details.cheque_payee) lines.push(`Cheque in favor of ${details.cheque_payee}.`);
  if (details.bank_name || details.bank_account_name) {
    lines.push(`Bank transfer: ${[details.bank_name, details.bank_account_name].filter(Boolean).join(" - ")}`);
  }
  const contact = details.contact_phone || fallbackPhone;
  const whatsapp = details.whatsapp_number;
  if (contact || whatsapp) {
    lines.push(`For payment help call${contact ? ` ${contact}` : ""}${whatsapp && whatsapp !== contact ? ` or WhatsApp ${whatsapp}` : whatsapp ? ` / WhatsApp ${whatsapp}` : ""}.`);
  }
  return lines;
}

function displayBusinessName(name: string) {
  return name.replace(/\bCymereg\b/g, "Cymreg");
}

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "solva-trade-report";
}

function generatedAt() {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Nairobi",
  }).format(new Date());
}

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Nairobi",
  }).format(new Date());
}

function parseAmount(value: string | null) {
  if (!value) return 0;
  const amount = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function submittedFields(searchParams: URLSearchParams) {
  const fields: Record<string, { label: string; value: string }> = {};
  searchParams.forEach((value, key) => {
    if (!key.startsWith("field_")) return;
    const fieldKey = key.slice("field_".length);
    const label = searchParams.get(`label_${fieldKey}`) ?? fieldKey.replaceAll("_", " ");
    if (value.trim()) fields[fieldKey] = { label, value: value.trim() };
  });
  return fields;
}

function fieldValue(fields: Record<string, { label: string; value: string }>, keys: string[], fallback = "") {
  for (const key of keys) {
    if (fields[key]?.value) return fields[key].value;
  }
  return fallback;
}

function amountFromTotals(totals: Record<string, string>, label: string) {
  return parseAmount(totals[label] ?? null);
}

function lineFieldValue(fields: Record<string, { label: string; value: string }>, index: number, key: string, fallback = "") {
  return fields[`line_${index}_${key}`]?.value ?? fallback;
}

function selectedSubmittedLineIndexes(fields: Record<string, { label: string; value: string }>) {
  const count = parseAmount(fields.line_count?.value ?? "0");
  if (!count) return [];
  return Array.from({ length: count }, (_, index) => index).filter((index) => {
    const selected = lineFieldValue(fields, index, "selected").toLowerCase();
    const productId = lineFieldValue(fields, index, "product_id");
    const quantity = parseAmount(lineFieldValue(fields, index, "quantity", "0"));
    return Boolean(productId && quantity > 0 && (selected === "yes" || selected === "on"));
  });
}

function reportLinesFromSubmittedGrid(fields: Record<string, { label: string; value: string }>, processName: string): ReportLine[] {
  const indexes = selectedSubmittedLineIndexes(fields);
  if (!indexes.length) return [];
  const receiving = `${processName}`.toLowerCase().includes("goods received") || `${processName}`.toLowerCase().includes("grn");
  return indexes.map((index) => {
    const productName = lineFieldValue(fields, index, "product_name", "Selected product");
    const productCode = lineFieldValue(fields, index, "product_code", productName);
    const quantity = parseAmount(lineFieldValue(fields, index, "quantity", "0"));
    const rejected = parseAmount(lineFieldValue(fields, index, "rejected_quantity", "0"));
    const acceptedQuantity = receiving ? Math.max(0, quantity - rejected) : quantity;
    const unitPrice = parseAmount(lineFieldValue(fields, index, receiving ? "unit_cost" : "unit_price", "0"));
    const taxRate = parseAmount(lineFieldValue(fields, index, "tax_rate", "0"));
    const taxAmount = parseAmount(lineFieldValue(fields, index, "tax_amount", "0"));
    const lineTotal = parseAmount(lineFieldValue(fields, index, "line_total", "0")) || acceptedQuantity * unitPrice + taxAmount;
    const batch = lineFieldValue(fields, index, "batch", receiving ? "Not provided" : "");
    const expiryDate = lineFieldValue(fields, index, "expiry_date", "");
    return {
      sku: productCode,
      description: productName,
      unit: "Each",
      quantity: acceptedQuantity,
      unitPrice,
      discount: parseAmount(lineFieldValue(fields, index, "discount", "0")),
      taxRate: taxRate ? `${taxRate.toFixed(2)}%` : "No tax entered",
      taxAmount,
      lineTotal,
      warehouse: fieldValue(fields, ["warehouse", "branch"], "Main workspace"),
      batch,
      notes: receiving
        ? `Delivered ${quantity}; rejected ${rejected}${expiryDate ? `; expiry ${expiryDate}` : ""}.`
        : "Posted from multi-item sale.",
      details: {
        Product: productName,
        Code: productCode,
        Delivered: String(quantity),
        Accepted: String(acceptedQuantity),
        Rejected: String(rejected),
        Batch: batch,
        Expiry: expiryDate,
        "Line total": money(lineTotal),
      },
    };
  });
}

function receiptPaymentStatus(report: Report) {
  const explicit = String(report.transaction["Payment status"] ?? "").trim();
  const total = amountFromTotals(report.totals, "Total");
  const paid = amountFromTotals(report.totals, "Amount paid");
  const balance = amountFromTotals(report.totals, "Balance due");
  if (balance <= 0 && (paid > 0 || total > 0 || explicit.toLowerCase() === "paid")) {
    return { label: "PAID", detail: "Payment confirmed and allocated", tone: "paid" };
  }
  if (paid > 0 || explicit.toLowerCase().includes("part")) {
    return { label: "PART PAID", detail: `Balance remaining ${money(balance)}`, tone: "partial" };
  }
  return { label: "UNPAID", detail: `Balance due ${money(balance || total)}`, tone: "unpaid" };
}

function reportLineFromFields(fields: Record<string, { label: string; value: string }>, processName = ""): ReportLine[] {
  const gridLines = reportLinesFromSubmittedGrid(fields, processName);
  if (gridLines.length) return gridLines;
  if (Object.keys(fields).length === 0) return [];
  const productName = fieldValue(fields, ["product_name", "product", "item", "sku"], "Entered item");
  const quantity = parseAmount(fieldValue(fields, ["opening_stock_quantity", "quantity", "ordered_quantity", "received_quantity", "accepted_quantity", "return_quantity", "quantity_sold"], "1"));
  const unitPrice = parseAmount(fieldValue(fields, ["selling_price_placeholder", "selling_price", "unit_price", "price", "unit_cost", "rate", "standard_cost"], "0"));
  const discount = parseAmount(fieldValue(fields, ["discount"], "0"));
  const taxAmount = parseAmount(fieldValue(fields, ["tax", "withholding_tax"], "0"));
  const taxRate = parseAmount(fieldValue(fields, ["vat_rate", "tax_rate"], "0"));
  const taxTreatment = fieldValue(fields, ["vat_treatment", "tax_treatment"], taxRate ? `${taxRate.toFixed(2)}%` : "No tax entered");
  const explicitTotal = parseAmount(fieldValue(fields, ["total", "amount", "balance_due", "amount_received", "amount_sent"], "0"));
  const subtotal = parseAmount(fieldValue(fields, ["subtotal"], "0")) || quantity * unitPrice;
  const lineTotal = explicitTotal || Math.max(0, subtotal - discount + taxAmount);
  const details = Object.fromEntries(Object.values(fields).map((field) => [field.label, field.value]));
  return [
    {
      sku: fieldValue(fields, ["sku", "product_code", "pack_sku", "barcode"], productName),
      description: fieldValue(fields, ["description", "product_name", "product", "reason", "purpose", "category", "report"], productName),
      unit: fieldValue(fields, ["base_stock_unit", "selling_unit", "purchase_unit", "unit"], "Each"),
      quantity: quantity || 1,
      unitPrice,
      discount,
      taxRate: taxTreatment,
      taxAmount,
      lineTotal,
      warehouse: fieldValue(fields, ["warehouse", "branch", "route", "account", "stock_location"], "Selected workspace"),
      batch: fieldValue(fields, ["batch", "reference", "po_number", "invoice", "document_number"], "Not provided"),
      notes: fieldValue(fields, ["brand", "category", "manufacturer"], "Generated from submitted form values."),
      details,
    },
  ];
}

function isProfileDocument(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return value.includes("customer profile") || value.includes("supplier profile");
}

function profileLinesFromFields(fields: Record<string, { label: string; value: string }>, processName: string): ReportLine[] {
  const entries = Object.entries(fields);
  if (!entries.length) return [];
  const today = todayIsoDate();
  return entries.map(([key, field], index) => {
    const lower = `${key} ${field.label}`.toLowerCase();
    const risk = lower.includes("kra") || lower.includes("pin") || lower.includes("vat") || lower.includes("tax") ? "Tax-sensitive" : "Normal";
    const status = lower.includes("opening balance") || lower.includes("credit") ? "Review" : "Captured";
    const details = {
      Field: field.label,
      Value: field.value,
      Status: status,
      "Verified By": "Tenant user",
      "Updated On": today,
      Risk: risk,
      Notes: `${processName} field captured from the submitted business form.`,
    };
    return {
      sku: String(index + 1).padStart(2, "0"),
      description: field.label,
      unit: "Profile field",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: status,
      taxAmount: 0,
      lineTotal: 0,
      warehouse: "Tenant master data",
      batch: risk,
      notes: details.Notes,
      details,
    };
  });
}

function isPurchaseSourceReport(processName: string) {
  const value = processName.toLowerCase();
  return (
    value.includes("purchase source profitability") ||
    value.includes("direct vs local") ||
    value.includes("emergency purchase impact") ||
    value.includes("supplier price comparison")
  );
}

function isSalesSourceReport(processName: string) {
  const value = processName.toLowerCase();
  return (
    value.includes("sale source profitability") ||
    value.includes("profit by customer") ||
    value.includes("customer profit") ||
    value.includes("profit by supplier") ||
    value.includes("supplier source profit") ||
    value.includes("source profit by sale") ||
    value.includes("fifo profit") ||
    value.includes("profit by purchase source") ||
    value.includes("direct supplier stock profit") ||
    value.includes("local market stock profit")
  );
}

function isSalesOperationalReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return (
    value.includes("basic daily sales report") ||
    value.includes("daily sales kpi report") ||
    value.includes("hourly sales report") ||
    value.includes("sales rep daily report") ||
    value.includes("weekly sales activity report") ||
    value.includes("weekly sales call report") ||
    value.includes("weekly route sales report") ||
    value.includes("sales tracking report") ||
    value.includes("customer sales and profit report") ||
    value.includes("customer sales statement") ||
    value.includes("sales generation per customer") ||
    value.includes("deal loss reasons report") ||
    value.includes("monthly retail sales summary report") ||
    value.includes("monthly sales report dashboard") ||
    value.includes("quarterly sales report") ||
    value.includes("annual sales performance report") ||
    value.includes("year-end sales report")
  );
}

function isKraEtrSalesReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return value.includes("kra etr sales") || value.includes("etr sales report") || value.includes("cui invoice");
}

function isExpenseOperationalReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return (
    value.includes("daily expense report") ||
    value.includes("weekly expense report") ||
    value.includes("monthly expense report") ||
    value.includes("annual expense report") ||
    value.includes("office expense report") ||
    value.includes("expense analysis report")
  );
}

function isFinancialStatementReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return (
    value.includes("profit and loss") ||
    value.includes("income statement") ||
    value.includes("trial balance") ||
    value.includes("balance sheet") ||
    value.includes("cash flow") ||
    value.includes("general ledger") ||
    value.includes("account ledger") ||
    value.includes("bank reconciliation")
  );
}

function isProfitAndLossReport(reportOrModule: Report | string, processName?: string) {
  const value =
    typeof reportOrModule === "string"
      ? `${reportOrModule} ${processName ?? ""}`.toLowerCase()
      : `${reportOrModule.moduleName} ${reportOrModule.processName}`.toLowerCase();
  return value.includes("profit and loss") || value.includes("income statement");
}

function isTrialBalanceReport(report: Report) {
  return `${report.moduleName} ${report.processName}`.toLowerCase().includes("trial balance");
}

function isBalanceSheetReport(report: Report) {
  return `${report.moduleName} ${report.processName}`.toLowerCase().includes("balance sheet");
}

function isCashFlowStatementReport(report: Report) {
  return `${report.moduleName} ${report.processName}`.toLowerCase().includes("cash flow");
}

function isGeneralLedgerReport(report: Report) {
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  return value.includes("general ledger") || value.includes("account ledger");
}

function isBankReconciliationReport(report: Report) {
  return `${report.moduleName} ${report.processName}`.toLowerCase().includes("bank reconciliation");
}

function isProductMasterReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return (
    value.includes("product master") ||
    value.includes("printable inventory") ||
    value.includes("product catalogue") ||
    value.includes("inventory master")
  );
}

function isProductProfileReport(moduleName: string, processName: string) {
  return `${moduleName} ${processName}`.toLowerCase().includes("product profile");
}

function isCustomerProfileReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return value.includes("customer profile") || (moduleName.toLowerCase() === "customers" && processName.toLowerCase().includes("customer"));
}

function isCustomerPriceListReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return value.includes("customer price list") || value.includes("customer catalogue");
}

function isInventoryOperationalReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return (
    value.includes("weekly inventory report") ||
    value.includes("monthly inventory report") ||
    value.includes("annual inventory report") ||
    value.includes("inventory damage report") ||
    value.includes("product inventory usage report") ||
    value.includes("inventory sales report") ||
    value.includes("inventory discrepancy report") ||
    value.includes("inventory aging report") ||
    value.includes("inventory audit report")
  );
}

function numberValue(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function detailAmount(value: string | undefined) {
  if (!value) return 0;
  const amount = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function detailValue(line: ReportLine, key: string, fallback = "") {
  return line.details?.[key] ?? fallback;
}

function periodLabel(kind: "week" | "month" | "year") {
  const now = new Date();
  if (kind === "year") return new Intl.DateTimeFormat("en-KE", { year: "numeric", timeZone: "Africa/Nairobi" }).format(now);
  if (kind === "month") return new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(now);
  return `Week of ${todayIsoDate()}`;
}

async function productMasterReportLines(productId?: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("products")
    .select(
      "id, product_name, short_name, product_code, sku, barcode, description, product_type, category_id, brand_id, manufacturer, base_unit_id, purchase_unit_id, selling_unit_id, track_inventory, track_batches, track_expiry, track_serial_numbers, track_returnable_packaging, tax_category, vat_status, preferred_costing_method, standard_cost, default_selling_price_placeholder, minimum_selling_price, reorder_level, reorder_quantity, maximum_stock_level, lead_time_days, shelf_life_days, weight, volume, active, archived, created_at",
    )
    .eq("business_id", businessId);

  if (productId) query = query.eq("id", productId).limit(1);
  else query = query.order("product_name", { ascending: true }).limit(1000);

  const { data: products } = await query;

  const rows = products ?? [];
  if (!rows.length) return [];

  const ids = rows.map((row) => String(row.id));
  const categoryIds = Array.from(new Set(rows.map((row) => row.category_id).filter(Boolean).map(String)));
  const brandIds = Array.from(new Set(rows.map((row) => row.brand_id).filter(Boolean).map(String)));
  const unitIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.base_unit_id, row.purchase_unit_id, row.selling_unit_id])
        .filter(Boolean)
        .map(String),
    ),
  );

  const [{ data: categories }, { data: brands }, { data: units }, { data: balances }, { data: packs }, { data: receipts }] = await Promise.all([
    categoryIds.length
      ? supabase.from("product_categories").select("id, category_name").in("id", categoryIds)
      : Promise.resolve({ data: [] }),
    brandIds.length ? supabase.from("brands").select("id, brand_name, manufacturer_or_owner").in("id", brandIds) : Promise.resolve({ data: [] }),
    unitIds.length ? supabase.from("units_of_measure").select("id, name, symbol").in("id", unitIds) : Promise.resolve({ data: [] }),
    supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, available_quantity, average_unit_cost, total_inventory_value, reorder_status")
      .eq("business_id", businessId)
      .in("product_id", ids),
    supabase
      .from("product_pack_units")
      .select("product_id, conversion_factor, barcode, sku, default_purchase_unit, default_sales_unit, from_unit_id, to_unit_id")
      .eq("business_id", businessId)
      .in("product_id", ids)
      .eq("active", true),
    supabase
      .from("stock_movements")
      .select("product_id, movement_date, reference_number, source_supplier_name")
      .eq("business_id", businessId)
      .in("product_id", ids)
      .eq("movement_type", "purchase_receipt")
      .order("movement_date", { ascending: false }),
  ]);

  const categoryMap = new Map((categories ?? []).map((row) => [String(row.id), String(row.category_name ?? "")]));
  const brandMap = new Map((brands ?? []).map((row) => [String(row.id), row as { brand_name?: string | null; manufacturer_or_owner?: string | null }]));
  const unitMap = new Map((units ?? []).map((row) => [String(row.id), `${row.name ?? "Unit"}${row.symbol ? ` (${row.symbol})` : ""}`]));
  const balanceMap = new Map<string, { quantity: number; available: number; averageCost: number; value: number; status: string }>();
  for (const balance of balances ?? []) {
    const key = String(balance.product_id);
    const current = balanceMap.get(key) ?? { quantity: 0, available: 0, averageCost: 0, value: 0, status: "healthy" };
    const quantity = current.quantity + numberValue(balance.quantity_on_hand);
    const available = current.available + numberValue(balance.available_quantity);
    const value = current.value + numberValue(balance.total_inventory_value);
    balanceMap.set(key, {
      quantity,
      available,
      averageCost: quantity ? value / quantity : numberValue(balance.average_unit_cost),
      value,
      status: String(balance.reorder_status ?? current.status),
    });
  }

  const packMap = new Map<string, string>();
  for (const pack of packs ?? []) {
    if (packMap.has(String(pack.product_id))) continue;
    const fromUnit = unitMap.get(String(pack.from_unit_id)) ?? "Purchase unit";
    const toUnit = unitMap.get(String(pack.to_unit_id)) ?? "Base unit";
    const sku = pack.sku ? `, SKU ${pack.sku}` : "";
    const barcode = pack.barcode ? `, barcode ${pack.barcode}` : "";
    packMap.set(String(pack.product_id), `1 ${fromUnit} = ${numberValue(pack.conversion_factor)} ${toUnit}${sku}${barcode}`);
  }

  const receiptMap = new Map<string, { date: string; supplier: string; reference: string }>();
  for (const receipt of receipts ?? []) {
    const key = String(receipt.product_id);
    if (receiptMap.has(key)) continue;
    receiptMap.set(key, {
      date: String(receipt.movement_date ?? "").slice(0, 10),
      supplier: String(receipt.source_supplier_name ?? ""),
      reference: String(receipt.reference_number ?? ""),
    });
  }

  return rows.map((product) => {
    const brand = product.brand_id ? brandMap.get(String(product.brand_id)) : null;
    const balance = balanceMap.get(String(product.id)) ?? { quantity: 0, available: 0, averageCost: 0, value: 0, status: "no stock" };
    const standardCost = numberValue(product.standard_cost) || balance.averageCost;
    const stockValue = balance.value || standardCost * balance.quantity;
    const reorderLevel = numberValue(product.reorder_level);
    const reorderStatus =
      !product.track_inventory ? "not tracked" : balance.quantity <= 0 ? "out of stock" : reorderLevel && balance.available <= reorderLevel ? "reorder" : balance.status || "ok";
    const receipt = receiptMap.get(String(product.id));
    const details = {
      "Reorder status": reorderStatus,
      "Item no.": String(product.product_code ?? ""),
      SKU: String(product.sku ?? ""),
      Barcode: String(product.barcode ?? ""),
      "Date of last order": receipt?.date || "No receipt posted",
      "Item name": String(product.product_name ?? ""),
      Brand: String(brand?.brand_name ?? ""),
      Category: product.category_id ? categoryMap.get(String(product.category_id)) ?? "" : "",
      Vendor: receipt?.supplier || "Not recorded",
      "Stock location": "All warehouses",
      Description: String(product.description ?? product.short_name ?? ""),
      "Base unit": product.base_unit_id ? unitMap.get(String(product.base_unit_id)) ?? "" : "",
      "Purchase unit": product.purchase_unit_id ? unitMap.get(String(product.purchase_unit_id)) ?? "" : "",
      "Selling unit": product.selling_unit_id ? unitMap.get(String(product.selling_unit_id)) ?? "" : "",
      "Pack conversion": packMap.get(String(product.id)) ?? "No pack conversion",
      "Cost per item": money(standardCost),
      "Selling price": money(numberValue(product.default_selling_price_placeholder)),
      "Minimum selling price": money(numberValue(product.minimum_selling_price)),
      "Stock quantity": balance.quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      "Available quantity": balance.available.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      "Total value": money(stockValue),
      "Reorder level": reorderLevel.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      "Days per reorder": product.lead_time_days ? String(product.lead_time_days) : "Not set",
      "Item reorder quantity": numberValue(product.reorder_quantity).toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      "Max stock level": product.maximum_stock_level ? numberValue(product.maximum_stock_level).toLocaleString("en-KE", { maximumFractionDigits: 2 }) : "Not set",
      "VAT treatment": String(product.vat_status ?? product.tax_category ?? "Not set"),
      "Product type": String(product.product_type ?? "").replaceAll("_", " "),
      Tracking: [
        product.track_inventory ? "inventory" : "",
        product.track_batches ? "batch" : "",
        product.track_expiry ? "expiry" : "",
        product.track_serial_numbers ? "serial" : "",
        product.track_returnable_packaging ? "returnable packaging" : "",
      ].filter(Boolean).join(", ") || "not tracked",
      Manufacturer: String(product.manufacturer ?? brand?.manufacturer_or_owner ?? ""),
      "Shelf life days": product.shelf_life_days ? String(product.shelf_life_days) : "Not set",
      Weight: product.weight ? String(product.weight) : "Not set",
      Volume: product.volume ? String(product.volume) : "Not set",
      Status: product.archived ? "Archived" : product.active ? "Active" : "Inactive",
    };

    return {
      sku: details.SKU || details["Item no."],
      description: details["Item name"],
      unit: details["Base unit"] || "Unit",
      quantity: balance.quantity,
      unitPrice: standardCost,
      discount: 0,
      taxRate: details["VAT treatment"],
      taxAmount: stockValue,
      lineTotal: stockValue,
      warehouse: details["Stock location"],
      batch: details["Reorder status"],
      notes: `${details.Brand || "No brand"} - ${details.Category || "No category"} - ${details["Pack conversion"]}`,
      details,
    };
  });
}

async function customerNameForReport(customerId?: string | null) {
  const businessId = await activeReportBusinessId();
  if (!businessId || !customerId) return "";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("customer_name")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();
  return String(data?.customer_name ?? "");
}

async function customerPriceListReportLines(searchParams: URLSearchParams): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const indexes = Array.from(
    new Set(
      Array.from(searchParams.keys())
        .map((key) => /^product_id_(\d+)$/.exec(key)?.[1])
        .filter(Boolean) as string[],
    ),
  )
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);

  const selected = indexes
    .filter((index) => searchParams.get(`include_${index}`) === "yes")
    .map((index) => ({
      index,
      productId: searchParams.get(`product_id_${index}`) ?? "",
      price: numberValue(searchParams.get(`price_${index}`)),
      note: String(searchParams.get(`note_${index}`) ?? "").trim(),
    }))
    .filter((item) => item.productId);

  if (!selected.length) return [];

  const supabase = await createSupabaseServerClient();
  const productIds = selected.map((item) => item.productId);
  const [{ data: products }, { data: balances }] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_name, product_code, sku, default_selling_price_placeholder, vat_status, tax_category, active, archived")
      .eq("business_id", businessId)
      .in("id", productIds),
    supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, available_quantity")
      .eq("business_id", businessId)
      .in("product_id", productIds),
  ]);

  const productMap = new Map((products ?? []).map((product) => [String(product.id), product]));
  const balanceMap = new Map<string, number>();
  for (const balance of balances ?? []) {
    const key = String(balance.product_id);
    balanceMap.set(key, (balanceMap.get(key) ?? 0) + numberValue(balance.available_quantity ?? balance.quantity_on_hand));
  }

  return selected.map((item, lineIndex) => {
    const product = productMap.get(item.productId);
    const price = item.price || numberValue(product?.default_selling_price_placeholder);
    const vatTreatment = String(product?.vat_status ?? product?.tax_category ?? "VAT inclusive where applicable").replaceAll("_", " ");
    const code = String(product?.sku ?? product?.product_code ?? `ITEM-${lineIndex + 1}`);
    const name = String(product?.product_name ?? "Product");
    const available = balanceMap.get(item.productId) ?? 0;
    const details = {
      "#": String(lineIndex + 1),
      "Item no.": String(product?.product_code ?? code),
      Product: name,
      SKU: code,
      "Customer price": money(price),
      "VAT treatment": vatTreatment,
      "Available quantity": available.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      Notes: item.note || "Customer-specific price for this catalogue.",
    };

    return {
      sku: code,
      description: name,
      unit: "Item",
      quantity: 1,
      unitPrice: price,
      discount: 0,
      taxRate: vatTreatment,
      taxAmount: 0,
      lineTotal: price,
      warehouse: "Customer catalogue",
      batch: "Price list",
      notes: details.Notes,
      details,
    };
  });
}

async function customerProfileReportLines(customerId?: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId || !customerId) return [];

  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_code, customer_name, customer_type, kra_pin, phone, email, default_payment_terms, credit_limit, current_balance, status, active, created_at, updated_at, branches(branch_name, branch_code)")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) return [];

  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("address_label, physical_address, town, county, contact_person, contact_phone, delivery_instructions, is_default, active")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .limit(3);

  const branch = relatedOne(customer.branches as { branch_name?: string | null; branch_code?: string | null } | { branch_name?: string | null; branch_code?: string | null }[] | null);
  const defaultAddress = addresses?.[0];
  const location = [defaultAddress?.physical_address, defaultAddress?.town, defaultAddress?.county].filter(Boolean).join(", ") || "Not provided";
  const terms = String(customer.default_payment_terms ?? "due_immediately").replaceAll("_", " ");
  const status = customer.active === false ? "Inactive" : String(customer.status ?? "active");
  const balance = numberValue(customer.current_balance);
  const creditLimit = numberValue(customer.credit_limit);
  const details = {
    "Customer code": String(customer.customer_code ?? ""),
    "Customer name": String(customer.customer_name ?? ""),
    "Customer type": String(customer.customer_type ?? "business"),
    Phone: String(customer.phone ?? "Not provided"),
    Email: String(customer.email ?? "Not provided"),
    "KRA PIN": String(customer.kra_pin ?? "Not provided"),
    "Town or area": String(defaultAddress?.town ?? "Not provided"),
    "Delivery route": String(defaultAddress?.delivery_instructions ?? "Not provided").replace(/^Preferred route:\s*/i, ""),
    "Default address": location,
    "Contact person": String(defaultAddress?.contact_person ?? customer.customer_name ?? ""),
    "Contact phone": String(defaultAddress?.contact_phone ?? customer.phone ?? "Not provided"),
    Branch: [branch?.branch_name, branch?.branch_code].filter(Boolean).join(" - ") || "Main workspace",
    "Payment terms": terms,
    "Credit limit": money(creditLimit),
    "Current balance": money(balance),
    Status: status,
    "Created on": String(customer.created_at ?? "").slice(0, 10),
    "Updated on": String(customer.updated_at ?? "").slice(0, 10),
    "Follow-up status": balance > 0 ? "Has outstanding balance" : "No balance due",
    "Credit risk": balance > creditLimit && creditLimit > 0 ? "Above credit limit" : balance > 0 ? "Monitor" : "Normal",
  };

  return Object.entries(details).map(([label, value], index) => {
    const risk = /kra|pin|credit|balance|terms/i.test(label) ? "Review" : "Normal";
    return {
      sku: String(index + 1).padStart(2, "0"),
      description: label,
      unit: "Profile field",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: String(details.Status),
      taxAmount: 0,
      lineTotal: 0,
      warehouse: details.Branch,
      batch: risk,
      notes: `${label}: ${value}`,
      details: {
        Field: label,
        Value: value,
        Status: value && value !== "Not provided" ? "Captured" : "Missing",
        "Verified By": "Tenant user",
        "Updated On": details["Updated on"] || todayIsoDate(),
        Risk: risk,
        Notes: label === "Current balance" ? details["Follow-up status"] : "Saved customer master-data field.",
      },
    };
  });
}

function inventoryPeriodReportLines(base: ReportLine[], processName: string): ReportLine[] {
  const lower = processName.toLowerCase();
  const period = lower.includes("annual") ? periodLabel("year") : lower.includes("monthly") ? periodLabel("month") : periodLabel("week");
  const periodColumns = lower.includes("annual")
    ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    : lower.includes("monthly")
      ? ["Week 1", "Week 2", "Week 3", "Week 4", "Month total"]
      : ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return base.map((line) => {
    const quantity = detailAmount(detailValue(line, "Stock quantity"));
    const value = detailAmount(detailValue(line, "Total value"));
    const periodDetails = Object.fromEntries(periodColumns.map((column) => [column, column === periodColumns.at(-1) ? quantity.toLocaleString("en-KE") : ""]));
    return {
      ...line,
      taxAmount: value,
      lineTotal: value,
      notes: `Inventory snapshot for ${period}. ${detailValue(line, "Reorder status", "Review")} status.`,
      details: {
        Period: period,
        ...periodDetails,
        "Item no.": detailValue(line, "Item no."),
        Name: detailValue(line, "Item name"),
        Description: detailValue(line, "Description"),
        Type: detailValue(line, "Product type"),
        Remarks: detailValue(line, "Reorder status"),
        Department: detailValue(line, "Category"),
        Space: detailValue(line, "Stock location"),
        Condition: quantity > 0 ? "Good" : "No stock on hand",
        Vendor: detailValue(line, "Vendor"),
        "Service years remaining": detailValue(line, "Shelf life days"),
        "Current quantity": quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Current value": money(value),
        Status: detailValue(line, "Status"),
      },
    };
  });
}

function inventoryDamageReportLines(base: ReportLine[]): ReportLine[] {
  return base.map((line) => {
    const quantity = detailAmount(detailValue(line, "Stock quantity"));
    const unitCost = detailAmount(detailValue(line, "Cost per item"));
    const damagedQuantity = 0;
    return {
      ...line,
      quantity: damagedQuantity,
      unitPrice: unitCost,
      taxAmount: unitCost,
      lineTotal: 0,
      batch: "Damage register",
      notes: "No damage movement posted for this item in live inventory records.",
      details: {
        "Item no.": detailValue(line, "Item no."),
        Name: detailValue(line, "Item name"),
        Description: detailValue(line, "Description"),
        Type: detailValue(line, "Product type"),
        Department: detailValue(line, "Category"),
        Space: detailValue(line, "Stock location"),
        "Date of last order": detailValue(line, "Date of last order"),
        Vendor: detailValue(line, "Vendor"),
        "Purchase price per item": detailValue(line, "Cost per item"),
        "Warranty expiry date": "Not recorded",
        Condition: quantity > 0 ? "Good" : "No stock on hand",
        "Damage report": "No damage posted",
        Quantity: String(damagedQuantity),
        "Asset value": money(unitCost),
        "Total value": money(0),
        Model: detailValue(line, "SKU"),
        "Vendor no.": detailValue(line, "Vendor"),
      },
    };
  });
}

function inventoryUsageReportLines(base: ReportLine[]): ReportLine[] {
  return base.map((line) => {
    const quantity = detailAmount(detailValue(line, "Available quantity") || detailValue(line, "Stock quantity"));
    const reorderLevel = detailAmount(detailValue(line, "Reorder level"));
    const reorderQty = detailAmount(detailValue(line, "Item reorder quantity"));
    const aboveBelow = quantity - reorderLevel;
    const reorderRequired = reorderLevel > 0 && quantity <= reorderLevel ? "YES" : "NO";
    return {
      ...line,
      taxAmount: aboveBelow,
      lineTotal: reorderQty * detailAmount(detailValue(line, "Cost per item")),
      batch: reorderRequired === "YES" ? "Reorder required" : "In stock",
      notes: reorderRequired === "YES" ? "Buy this item or confirm incoming purchase order." : "Current quantity is above reorder level.",
      details: {
        "Reorder required (auto-fill)": reorderRequired,
        "Item on reorder?": "Not recorded",
        "Item no.": detailValue(line, "Item no."),
        "Date of stock check": todayIsoDate(),
        "Item name": detailValue(line, "Item name"),
        Vendor: detailValue(line, "Vendor"),
        "Vendor SKU": detailValue(line, "SKU"),
        "Qty in stock": quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Reorder level": reorderLevel.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Qty above / below par": aboveBelow.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Days per reorder": detailValue(line, "Days per reorder"),
        "Date of last order": detailValue(line, "Date of last order"),
        "Date received / restocked": detailValue(line, "Date of last order"),
        "Ordered by": "Purchasing team",
        "Unit cost": detailValue(line, "Cost per item"),
        "Order qty": reorderQty.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Total order": money(reorderQty * detailAmount(detailValue(line, "Cost per item"))),
      },
    };
  });
}

function inventoryDiscrepancyReportLines(base: ReportLine[]): ReportLine[] {
  return base.map((line) => {
    const quantity = detailAmount(detailValue(line, "Stock quantity"));
    const reorderLevel = detailAmount(detailValue(line, "Reorder level"));
    return {
      ...line,
      taxAmount: 0,
      lineTotal: quantity * detailAmount(detailValue(line, "Cost per item")),
      batch: "Count pending",
      notes: "No physical count has been entered against this item in the selected period.",
      details: {
        "Reorder (auto-fill)": reorderLevel > 0 && quantity <= reorderLevel ? "YES" : "NO",
        "Discrepancy (auto-fill)": "Not counted",
        "Item no.": detailValue(line, "Item no."),
        "Date of last order": detailValue(line, "Date of last order"),
        "Item name": detailValue(line, "Item name"),
        Vendor: detailValue(line, "Vendor"),
        "Stock location": detailValue(line, "Stock location"),
        Description: detailValue(line, "Description"),
        "On-hand quantity": quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Actual item count": "Not entered",
        "Inventory discrepancy (auto-fill)": "Awaiting count",
        "Reorder level": detailValue(line, "Reorder level"),
        "Days per reorder": detailValue(line, "Days per reorder"),
        "Item reorder quantity": detailValue(line, "Item reorder quantity"),
        "Item discontinued?": detailValue(line, "Status") === "Archived" ? "YES" : "NO",
      },
    };
  });
}

function inventoryAgingReportLines(base: ReportLine[]): ReportLine[] {
  return base.map((line) => {
    const lastOrder = detailValue(line, "Date of last order");
    const receivedDate = /^\d{4}-\d{2}-\d{2}$/.test(lastOrder) ? new Date(`${lastOrder}T00:00:00.000Z`) : null;
    const ageDays = receivedDate ? Math.max(0, Math.floor((Date.now() - receivedDate.getTime()) / 86_400_000)) : 0;
    const bucket = !receivedDate ? "No receipt posted" : ageDays <= 30 ? "0-30 days" : ageDays <= 60 ? "31-60 days" : ageDays <= 90 ? "61-90 days" : "Over 90 days";
    const value = detailAmount(detailValue(line, "Total value"));
    return {
      ...line,
      taxRate: bucket,
      taxAmount: ageDays,
      lineTotal: value,
      batch: bucket,
      notes: bucket === "Over 90 days" ? "Review pricing, promotion or supplier buying quantity." : "Stock age is within normal review range.",
      details: {
        "Item no.": detailValue(line, "Item no."),
        "Item name": detailValue(line, "Item name"),
        Brand: detailValue(line, "Brand"),
        Category: detailValue(line, "Category"),
        "Stock location": detailValue(line, "Stock location"),
        "Last received": lastOrder,
        "Age days": receivedDate ? String(ageDays) : "Not available",
        "Age bucket": bucket,
        "Qty in stock": detailValue(line, "Stock quantity"),
        "Unit cost": detailValue(line, "Cost per item"),
        "Inventory value": detailValue(line, "Total value"),
        "Risk level": bucket === "Over 90 days" ? "High" : bucket === "61-90 days" ? "Medium" : "Low",
        "Recommended action": bucket === "Over 90 days" ? "Discount, bundle, return or stop reordering" : "Monitor normal movement",
      },
    };
  });
}

function inventoryAuditReportLines(base: ReportLine[]): ReportLine[] {
  return base.map((line) => {
    const quantity = detailAmount(detailValue(line, "Stock quantity"));
    const reorderLevel = detailAmount(detailValue(line, "Reorder level"));
    return {
      ...line,
      taxAmount: detailAmount(detailValue(line, "Total value")),
      lineTotal: detailAmount(detailValue(line, "Total value")),
      batch: "Audit extract",
      notes: `Audit row includes setup, costing, balance and reorder controls. ${line.notes}`,
      details: {
        "Reorder (auto-fill)": reorderLevel > 0 && quantity <= reorderLevel ? "YES" : "NO",
        "Item no.": detailValue(line, "Item no."),
        "Date of last order": detailValue(line, "Date of last order"),
        "Item name": detailValue(line, "Item name"),
        Vendor: detailValue(line, "Vendor"),
        "Stock location": detailValue(line, "Stock location"),
        Description: detailValue(line, "Description"),
        "Cost per item": detailValue(line, "Cost per item"),
        "Stock quantity": detailValue(line, "Stock quantity"),
        "Total value": detailValue(line, "Total value"),
        "Reorder level": detailValue(line, "Reorder level"),
        "Days per reorder": detailValue(line, "Days per reorder"),
        "Item reorder quantity": detailValue(line, "Item reorder quantity"),
        "Item discontinued?": detailValue(line, "Status") === "Archived" ? "YES" : "NO",
        "VAT treatment": detailValue(line, "VAT treatment"),
        Tracking: detailValue(line, "Tracking"),
      },
    };
  });
}

async function inventorySalesReportLines(): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("sales_source_allocations")
    .select("allocated_at, quantity, unit_cost, total_cost, sale_value, sale_unit_price, sales_invoice_items(invoice_quantity, unit_price, line_total)")
    .eq("business_id", businessId)
    .order("allocated_at", { ascending: true })
    .limit(1000);

  const grouped = new Map<string, { revenue: number; units: number; grossProfit: number }>();
  for (const row of data ?? []) {
    const date = row.allocated_at ? new Date(String(row.allocated_at)) : new Date();
    const key = new Intl.DateTimeFormat("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(date);
    const current = grouped.get(key) ?? { revenue: 0, units: 0, grossProfit: 0 };
    const revenue = authoritativeAllocationSaleValue(row);
    current.revenue += revenue;
    current.units += numberValue(row.quantity);
    current.grossProfit += revenue - allocationCost(row);
    grouped.set(key, current);
  }

  let previousRevenue = 0;
  let previousUnits = 0;
  let previousAov = 0;
  return Array.from(grouped.entries()).map(([period, values]) => {
    const aov = values.units ? values.revenue / values.units : 0;
    const revenueGrowth = previousRevenue ? ((values.revenue - previousRevenue) / previousRevenue) * 100 : 0;
    const unitGrowth = previousUnits ? ((values.units - previousUnits) / previousUnits) * 100 : 0;
    const aovGrowth = previousAov ? ((aov - previousAov) / previousAov) * 100 : 0;
    previousRevenue = values.revenue;
    previousUnits = values.units;
    previousAov = aov;
    return {
      sku: period,
      description: `Inventory sales performance for ${period}`,
      unit: "Month",
      quantity: values.units,
      unitPrice: aov,
      discount: values.grossProfit,
      taxRate: `${revenueGrowth.toFixed(1)}% revenue growth`,
      taxAmount: values.grossProfit,
      lineTotal: values.revenue,
      warehouse: "All sales channels",
      batch: period,
      notes: values.grossProfit >= 0 ? "Positive gross profit from posted sales allocations." : "Negative gross profit; review source costs and selling prices.",
      details: {
        "Month / year": period,
        "Revenue (KES)": money(values.revenue),
        "Units sold (#)": values.units.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Avg order value (KES)": money(aov),
        "Revenue growth (%)": `${revenueGrowth.toFixed(1)}%`,
        "Units sold growth (%)": `${unitGrowth.toFixed(1)}%`,
        "AOV growth (%)": `${aovGrowth.toFixed(1)}%`,
        "Gross profit": money(values.grossProfit),
      },
    };
  });
}

async function inventoryOperationalReportLines(processName: string): Promise<ReportLine[]> {
  if (processName.toLowerCase().includes("sales")) return inventorySalesReportLines();
  const base = await productMasterReportLines();
  const lower = processName.toLowerCase();
  if (lower.includes("damage")) return inventoryDamageReportLines(base);
  if (lower.includes("usage")) return inventoryUsageReportLines(base);
  if (lower.includes("discrepancy")) return inventoryDiscrepancyReportLines(base);
  if (lower.includes("aging")) return inventoryAgingReportLines(base);
  if (lower.includes("audit")) return inventoryAuditReportLines(base);
  return inventoryPeriodReportLines(base, processName);
}

function startOfWeekDate(today: string) {
  const date = new Date(`${today}T00:00:00+03:00`);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function expenseReportPeriod(processName: string) {
  const today = todayIsoDate();
  const lower = processName.toLowerCase();
  if (lower.includes("daily")) return { label: "Today", start: today, end: today };
  if (lower.includes("weekly")) return { label: "This week", start: startOfWeekDate(today), end: today };
  if (lower.includes("monthly") || lower.includes("analysis") || lower.includes("office")) return { label: "This month", start: `${today.slice(0, 7)}-01`, end: today };
  return { label: "This year", start: `${today.slice(0, 4)}-01-01`, end: today };
}

function paidFromFromDescription(description: string | null | undefined) {
  const text = String(description ?? "");
  const match = text.match(/Paid from:\s*([^|]+)/i);
  return match?.[1]?.trim() || "Not specified";
}

async function expenseOperationalReportLines(processName: string): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const period = expenseReportPeriod(processName);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("expenses")
    .select("expense_number, expense_date, expense_category, payee, amount, tax_amount, total_paid, description, approval_status, posted_status, created_at")
    .eq("business_id", businessId)
    .gte("expense_date", period.start)
    .lte("expense_date", period.end)
    .order("expense_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);

  const rows = data ?? [];
  if (!rows.length) {
    return [
      {
        sku: "NO-EXPENSES",
        description: "No expenses posted",
        unit: period.label,
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        taxRate: "0%",
        taxAmount: 0,
        lineTotal: 0,
        warehouse: "Cash & Bank",
        batch: processName,
        notes: `No posted expenses were found from ${period.start} to ${period.end}.`,
        details: {
          Period: period.label,
          From: period.start,
          To: period.end,
          "Expense type": "No expenses posted",
          "Total paid": money(0),
        },
      },
    ];
  }

  return rows.map((expense, index) => {
    const amountSpent = Number(expense.total_paid ?? 0) || Number(expense.amount ?? 0) + Number(expense.tax_amount ?? 0);
    const tax = Number(expense.tax_amount ?? 0);
    const description = String(expense.description ?? "").replace(/\s*\|\s*Paid from:\s*[^|]+/i, "").trim();
    return {
      sku: String(expense.expense_number ?? `EXP-${index + 1}`),
      description: String(expense.expense_category ?? "Office expense"),
      unit: "Expense",
      quantity: 1,
      unitPrice: amountSpent,
      discount: 0,
      taxRate: tax > 0 ? "Input VAT" : "No VAT noted",
      taxAmount: tax,
      lineTotal: amountSpent,
      warehouse: paidFromFromDescription(expense.description),
      batch: String(expense.payee ?? "Not specified"),
      notes: description || "Posted office expense.",
      details: {
        "Sr. no.": String(index + 1),
        Date: String(expense.expense_date ?? ""),
        "Expense no.": String(expense.expense_number ?? ""),
        "Expense type": String(expense.expense_category ?? "Office expense"),
        "Paid to": String(expense.payee ?? "Not specified"),
        "Paid from": paidFromFromDescription(expense.description),
        "Amount spent": money(amountSpent),
        "Input VAT": money(tax),
        "Total paid": money(amountSpent),
        Status: String(expense.posted_status ?? expense.approval_status ?? "posted"),
        Notes: description || "",
      },
    };
  });
}

function sourceLabel(value: string | null | undefined) {
  const source = value || "unspecified";
  return source
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

async function activeReportBusinessId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const preferredBusinessId = await getActiveBusinessId();
  const metadataBusinessId = typeof user.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null;

  const membershipQuery = (db: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>) => {
    let query = db
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("active", true);
    if (preferredBusinessId) query = query.eq("business_id", preferredBusinessId);
    return query.order("joined_at", { ascending: true }).limit(1).maybeSingle();
  };

  let membership: { business_id: string | null } | null = null;
  try {
    const admin = createSupabaseAdminClient();
    const { data: adminMembership } = await membershipQuery(admin);
    membership = adminMembership;
  } catch {
    const { data: userMembership } = await membershipQuery(supabase);
    membership = userMembership;
  }

  if (!membership?.business_id && preferredBusinessId) {
    const { data: fallbackMembership } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = fallbackMembership;
  }

  return membership?.business_id ?? metadataBusinessId;
}

async function purchaseSourceReportLines(processName: string): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("stock_movements")
    .select(
      "reference_number, movement_date, source_type, source_supplier_name, quantity_base, unit_cost, total_cost, direct_reference_unit_cost, local_reference_unit_cost, source_unit_cost_variance, source_reason, products(product_name, product_code, sku, default_selling_price_placeholder)",
    )
    .eq("business_id", businessId)
    .eq("direction", "in")
    .eq("movement_type", "purchase_receipt")
    .neq("source_type", "unspecified")
    .order("movement_date", { ascending: false })
    .limit(200);

  const lower = processName.toLowerCase();
  if (lower.includes("emergency")) query = query.in("source_type", ["emergency_purchase", "spot_purchase"]);

  const { data } = await query;
  return (data ?? []).map((row) => {
    const productRecord = Array.isArray(row.products) ? row.products[0] : row.products;
    const product = productRecord as
      | { product_name?: string | null; product_code?: string | null; sku?: string | null; default_selling_price_placeholder?: number | string | null }
      | null;
    const quantity = Number(row.quantity_base ?? 0);
    const unitCost = Number(row.unit_cost ?? 0);
    const sellingPrice = Number(product?.default_selling_price_placeholder ?? 0);
    const directBenchmark = Number(row.direct_reference_unit_cost ?? 0);
    const unitVariance = directBenchmark ? unitCost - directBenchmark : Number(row.source_unit_cost_variance ?? 0);
    const costVariance = unitVariance * quantity;
    const potentialProfit = sellingPrice ? (sellingPrice - unitCost) * quantity : Number(row.total_cost ?? 0);

    return {
      sku: String(product?.sku ?? product?.product_code ?? row.reference_number ?? "SRC"),
      description: String(product?.product_name ?? "Purchased product"),
      unit: "Unit",
      quantity,
      unitPrice: unitCost,
      discount: directBenchmark,
      taxRate: directBenchmark ? `${money(directBenchmark)} direct` : "No direct benchmark",
      taxAmount: costVariance,
      lineTotal: potentialProfit,
      warehouse: String(row.source_supplier_name ?? "Supplier not recorded"),
      batch: sourceLabel(String(row.source_type ?? "unspecified")),
      notes:
        String(row.source_reason ?? "").trim() ||
        (directBenchmark
          ? unitVariance > 0
            ? "Bought above direct-supplier benchmark; review pricing or urgency."
            : "Bought within or below direct-supplier benchmark."
          : "Add direct benchmark cost to compare this source."),
    };
  });
}

async function salesSourceReportLines(processName: string): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("sales_source_allocations")
    .select(
      "source_type, source_supplier_name, quantity, unit_cost, total_cost, sale_unit_price, sale_value, allocated_at, products(product_name, product_code, sku), sales_invoice_items(invoice_quantity, unit_price, line_total), sales_invoices(invoice_number, invoice_date, customers(customer_name))",
    )
    .eq("business_id", businessId)
    .order("allocated_at", { ascending: false })
    .limit(300);

  const lower = processName.toLowerCase();
  if (lower.includes("direct")) query = query.eq("source_type", "direct_supplier");
  if (lower.includes("local market")) query = query.eq("source_type", "local_market");

  const { data } = await query;
  return (data ?? []).map((row) => {
    const productRecord = Array.isArray(row.products) ? row.products[0] : row.products;
    const invoiceRecord = Array.isArray(row.sales_invoices) ? row.sales_invoices[0] : row.sales_invoices;
    const customerRecord = Array.isArray(invoiceRecord?.customers) ? invoiceRecord?.customers[0] : invoiceRecord?.customers;
    const product = productRecord as { product_name?: string | null; product_code?: string | null; sku?: string | null } | null;
    const invoice = invoiceRecord as { invoice_number?: string | null; invoice_date?: string | null } | null;
    const customer = customerRecord as { customer_name?: string | null } | null;
    const cost = allocationCost(row);
    const saleValue = authoritativeAllocationSaleValue(row);
    const grossProfit = saleValue - cost;
    const margin = saleValue ? (grossProfit / saleValue) * 100 : 0;

    return {
      sku: String(product?.sku ?? product?.product_code ?? invoice?.invoice_number ?? "SALE"),
      description: `${String(product?.product_name ?? "Sold product")} - ${String(invoice?.invoice_number ?? "invoice")} ${customer?.customer_name ? `for ${customer.customer_name}` : ""}`.trim(),
      unit: "Unit",
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unit_cost ?? 0),
      discount: Number(row.sale_unit_price ?? 0),
      taxRate: `${margin.toFixed(1)}% margin`,
      taxAmount: cost,
      lineTotal: grossProfit,
      warehouse: String(row.source_supplier_name ?? "Source supplier not recorded"),
      batch: sourceLabel(String(row.source_type ?? "unspecified")),
      notes: grossProfit >= 0
        ? "Positive gross profit from this FIFO/source allocation."
        : "Loss-making source allocation; review buying price, selling price or urgency.",
    };
  });
}

async function profitByCustomerReportLines(searchParams?: URLSearchParams): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const period = salesPeriodWindow(searchParams?.get("period") ?? null, searchParams);
  const requestedCustomerId = searchParams?.get("customerId");
  let invoiceQuery = supabase
    .from("sales_invoices")
    .select("id, invoice_number, invoice_date, total_amount, amount_paid, balance_due, status, customer_id, customers(customer_name, customer_code, kra_pin, phone)")
    .eq("business_id", businessId)
    .neq("status", "reversed")
    .gte("invoice_date", period.start)
    .lte("invoice_date", period.end)
    .order("invoice_date", { ascending: true })
    .limit(3000);
  if (requestedCustomerId && requestedCustomerId !== "all") invoiceQuery = invoiceQuery.eq("customer_id", requestedCustomerId);

  const { data: invoices } = await invoiceQuery;
  const invoiceRows = (invoices ?? []) as SalesInvoiceRow[];
  const invoiceIds = invoiceRows.map((invoice) => invoice.id).filter(Boolean);
  if (!invoiceIds.length) return [];

  const { data: items } = await supabase
    .from("sales_invoice_items")
    .select("id, invoice_id, product_id, invoice_quantity, unit_price, line_total, products(product_name, product_code, sku)")
    .eq("business_id", businessId)
    .in("invoice_id", invoiceIds)
    .order("invoice_id", { ascending: true })
    .limit(10000);

  const invoicesById = new Map(invoiceRows.map((invoice) => [String(invoice.id), invoice]));
  return ((items ?? []) as SalesItemRow[]).map((item, index) => {
    const invoice = invoicesById.get(String(item.invoice_id));
    const product = relatedOne(item.products);
    const customer = relatedOne(invoice?.customers) as { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null } | null;
    const quantity = numberValue(item.invoice_quantity);
    const unitPrice = numberValue(item.unit_price);
    const lineTotal = numberValue(item.line_total);
    const customerName = String(customer?.customer_name ?? "Walk-in customer");
    return {
      sku: String(product?.sku ?? product?.product_code ?? ""),
      description: String(product?.product_name ?? "Sold item"),
      unit: "Item",
      quantity,
      unitPrice,
      discount: 0,
      taxRate: "Included where applicable",
      taxAmount: 0,
      lineTotal,
      warehouse: customerName,
      batch: String(invoice?.invoice_number ?? ""),
      notes: `Invoice ${String(invoice?.invoice_number ?? "not recorded")} dated ${dateKey(invoice?.invoice_date)}.`,
      details: {
        "#": String(index + 1),
        Date: dateKey(invoice?.invoice_date),
        Customer: customerName,
        "Customer code": String(customer?.customer_code ?? "-"),
        "Customer KRA PIN": String(customer?.kra_pin ?? "-"),
        "Customer phone": String(customer?.phone ?? "-"),
        "Invoice no.": String(invoice?.invoice_number ?? ""),
        Product: String(product?.product_name ?? "Sold item"),
        SKU: String(product?.sku ?? product?.product_code ?? ""),
        Qty: quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        Rate: money(unitPrice),
        Amount: money(lineTotal),
        "Payment status": numberValue(invoice?.balance_due) <= 0 ? "Paid" : numberValue(invoice?.amount_paid) > 0 ? "Part paid" : "Unpaid",
        "Amount paid": money(numberValue(invoice?.amount_paid)),
        "Balance due": money(numberValue(invoice?.balance_due)),
        Period: period.label,
      },
    };
  });
}

async function customerStatementReportLines(searchParams?: URLSearchParams): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const period = salesPeriodWindow(searchParams?.get("period") ?? null, searchParams);
  const requestedCustomerId = searchParams?.get("customerId");
  const paymentStart = `${period.start}T00:00:00.000+03:00`;
  const paymentEnd = `${period.end}T23:59:59.999+03:00`;
  const pageSize = 1000;

  function chunkIds(ids: string[], size = 400) {
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size));
    return chunks;
  }

  async function fetchInvoicesInWindow() {
    const rows: SalesInvoiceRow[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from("sales_invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid, balance_due, status, customer_id, customers(customer_name, customer_code, kra_pin, phone)")
        .eq("business_id", businessId)
        .neq("status", "reversed")
        .gte("invoice_date", period.start)
        .lte("invoice_date", period.end)
        .order("invoice_date", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (requestedCustomerId && requestedCustomerId !== "all") query = query.eq("customer_id", requestedCustomerId);
      const { data, error } = await query;
      if (error) throw error;
      const batch = (data ?? []) as SalesInvoiceRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  }

  async function fetchPaymentsInWindow() {
    const rows: CustomerPaymentRow[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from("customer_payments")
        .select("id, customer_id, payment_number, payment_date, amount_received, status, transaction_reference, payer_name, payer_phone, customers(customer_name, customer_code, kra_pin, phone)")
        .eq("business_id", businessId)
        .neq("status", "reversed")
        .gte("payment_date", paymentStart)
        .lte("payment_date", paymentEnd)
        .order("payment_date", { ascending: true })
        .range(from, from + pageSize - 1);
      if (requestedCustomerId && requestedCustomerId !== "all") query = query.eq("customer_id", requestedCustomerId);
      const { data, error } = await query;
      if (error) throw error;
      const batch = (data ?? []) as CustomerPaymentRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  }

  async function fetchOpeningInvoices() {
    const rows: { total_amount?: number | string | null }[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from("sales_invoices")
        .select("total_amount")
        .eq("business_id", businessId)
        .neq("status", "reversed")
        .lt("invoice_date", period.start)
        .range(from, from + pageSize - 1);
      if (requestedCustomerId && requestedCustomerId !== "all") query = query.eq("customer_id", requestedCustomerId);
      const { data, error } = await query;
      if (error) throw error;
      const batch = (data ?? []) as { total_amount?: number | string | null }[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  }

  async function fetchOpeningPayments() {
    const rows: { amount_received?: number | string | null }[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from("customer_payments")
        .select("amount_received")
        .eq("business_id", businessId)
        .neq("status", "reversed")
        .lt("payment_date", paymentStart)
        .range(from, from + pageSize - 1);
      if (requestedCustomerId && requestedCustomerId !== "all") query = query.eq("customer_id", requestedCustomerId);
      const { data, error } = await query;
      if (error) throw error;
      const batch = (data ?? []) as { amount_received?: number | string | null }[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  }

  const [invoiceRows, paymentRows, openingInvoices, openingPayments] = await Promise.all([
    fetchInvoicesInWindow(),
    fetchPaymentsInWindow(),
    fetchOpeningInvoices(),
    fetchOpeningPayments(),
  ]);

  const invoiceIds = invoiceRows.map((invoice) => invoice.id).filter(Boolean);
  const itemsByInvoice = new Map<string, string[]>();
  if (invoiceIds.length) {
    for (const idChunk of chunkIds(invoiceIds)) {
      for (let from = 0; ; from += pageSize) {
        const { data: items, error } = await supabase
          .from("sales_invoice_items")
          .select("invoice_id, products(product_name, product_code, sku)")
          .eq("business_id", businessId)
          .in("invoice_id", idChunk)
          .order("invoice_id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (items ?? []) as SalesItemRow[];
        for (const item of batch) {
          const product = relatedOne(item.products);
          const invoiceId = String(item.invoice_id ?? "");
          const name = String(product?.product_name ?? product?.sku ?? product?.product_code ?? "Sold item");
          if (!invoiceId) continue;
          itemsByInvoice.set(invoiceId, [...(itemsByInvoice.get(invoiceId) ?? []), name]);
        }
        if (batch.length < pageSize) break;
      }
    }
  }

  const openingBalance =
    openingInvoices.reduce((sum, invoice) => sum + numberValue(invoice.total_amount), 0) -
    openingPayments.reduce((sum, payment) => sum + numberValue(payment.amount_received), 0);

  type StatementEvent = {
    date: string;
    sortType: number;
    documentNo: string;
    type: "Invoice" | "Receipt";
    description: string;
    debit: number;
    credit: number;
    customerName: string;
    customerCode: string;
    customerPin: string;
    customerPhone: string;
    status: string;
  };

  const events: StatementEvent[] = [
    ...invoiceRows.map((invoice) => {
      const customer = relatedOne(invoice.customers) as { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null } | null;
      const products = itemsByInvoice.get(String(invoice.id)) ?? [];
      const productSummary =
        products.length > 4
          ? `${products.slice(0, 4).join(", ")} +${products.length - 4} more`
          : products.length
            ? products.join(", ")
            : "Goods sold";
      const customerName = String(customer?.customer_name ?? "Walk-in customer");
      return {
        date: dateKey(invoice.invoice_date),
        sortType: 1,
        documentNo: String(invoice.invoice_number ?? ""),
        type: "Invoice" as const,
        description: requestedCustomerId && requestedCustomerId !== "all" ? productSummary : `${customerName}: ${productSummary}`,
        debit: numberValue(invoice.total_amount),
        credit: 0,
        customerName,
        customerCode: String(customer?.customer_code ?? "-"),
        customerPin: String(customer?.kra_pin ?? "-"),
        customerPhone: String(customer?.phone ?? "-"),
        status: numberValue(invoice.balance_due) <= 0 ? "Paid" : numberValue(invoice.amount_paid) > 0 ? "Part paid" : "Unpaid",
      };
    }),
    ...paymentRows.map((payment) => {
      const customer = relatedOne(payment.customers) as { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null } | null;
      const customerName = String(customer?.customer_name ?? payment.payer_name ?? "Walk-in customer");
      const reference = String(payment.transaction_reference ?? "").trim();
      return {
        date: dateKey(payment.payment_date),
        sortType: 2,
        documentNo: String(payment.payment_number ?? reference ?? ""),
        type: "Receipt" as const,
        description: `${requestedCustomerId && requestedCustomerId !== "all" ? "" : `${customerName}: `}Payment received${reference ? ` (${reference})` : ""}`.trim(),
        debit: 0,
        credit: numberValue(payment.amount_received),
        customerName,
        customerCode: String(customer?.customer_code ?? "-"),
        customerPin: String(customer?.kra_pin ?? "-"),
        customerPhone: String(customer?.phone ?? payment.payer_phone ?? "-"),
        status: String(payment.status ?? "posted"),
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.sortType - b.sortType || a.documentNo.localeCompare(b.documentNo));

  if (!events.length) {
    return [
      {
        sku: "NO-ACTIVITY",
        description: "No account movement in this period",
        unit: "Statement",
        quantity: 0,
        unitPrice: openingBalance,
        discount: 0,
        taxRate: "",
        taxAmount: 0,
        lineTotal: 0,
        warehouse: requestedCustomerId && requestedCustomerId !== "all" ? await customerNameForReport(requestedCustomerId) : "All customers",
        batch: period.label,
        notes: "No invoices or receipts were posted for the selected period.",
        details: {
          "#": "1",
          Date: period.start,
          "Document No.": "-",
          Type: "No activity",
          Description: "No invoices or receipts were posted for the selected period.",
          Debit: money(0),
          Credit: money(0),
          Balance: money(openingBalance),
          "Opening balance": money(openingBalance),
          Period: period.label,
        },
      },
    ];
  }

  let runningBalance = openingBalance;
  return events.map((event, index) => {
    runningBalance += event.debit - event.credit;
    return {
      sku: event.documentNo,
      description: event.description,
      unit: event.type,
      quantity: 1,
      unitPrice: runningBalance,
      discount: event.credit,
      taxRate: "",
      taxAmount: 0,
      lineTotal: event.debit,
      warehouse: event.customerName,
      batch: event.status,
      notes: `${event.type} ${event.documentNo || "not recorded"} on ${event.date}.`,
      details: {
        "#": String(index + 1),
        Date: event.date,
        "Document No.": event.documentNo || "-",
        Type: event.type,
        Description: event.description,
        Debit: money(event.debit),
        Credit: money(event.credit),
        Balance: money(runningBalance),
        Customer: event.customerName,
        "Customer code": event.customerCode,
        "Customer KRA PIN": event.customerPin,
        "Customer phone": event.customerPhone,
        Status: event.status,
        "Opening balance": money(openingBalance),
        Period: period.label,
      },
    };
  });
}

async function profitBySupplierSourceReportLines(searchParams?: URLSearchParams): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const period = salesPeriodWindow(searchParams?.get("period") ?? null, searchParams);
  const supplierId = searchParams?.get("supplierId");
  const sourceType = searchParams?.get("sourceType");
  let query = supabase
    .from("sales_source_allocations")
    .select("source_type, source_supplier_id, source_supplier_name, quantity, unit_cost, total_cost, sale_unit_price, sale_value, allocated_at, products(product_name, sku, product_code), sales_invoice_items(invoice_quantity, unit_price, line_total)")
    .eq("business_id", businessId)
    .gte("allocated_at", `${period.start}T00:00:00`)
    .lte("allocated_at", `${period.end}T23:59:59`)
    .limit(5000);
  if (supplierId && supplierId !== "all") query = query.eq("source_supplier_id", supplierId);
  if (sourceType && sourceType !== "all") query = query.eq("source_type", sourceType);

  const { data } = await query;

  const grouped = new Map<string, { source: string; supplier: string; products: Set<string>; units: number; revenue: number; cost: number; profit: number }>();
  for (const row of data ?? []) {
    const productRecord = Array.isArray(row.products) ? row.products[0] : row.products;
    const product = productRecord as { product_name?: string | null; sku?: string | null; product_code?: string | null } | null;
    const source = sourceLabel(String(row.source_type ?? "unspecified"));
    const supplier = String(row.source_supplier_name ?? "Supplier/source not recorded");
    const key = `${source}::${supplier}`;
    const current = grouped.get(key) ?? { source, supplier, products: new Set<string>(), units: 0, revenue: 0, cost: 0, profit: 0 };
    if (product?.product_name || product?.sku || product?.product_code) {
      current.products.add(String(product.product_name ?? product.sku ?? product.product_code));
    }
    current.units += numberValue(row.quantity);
    const revenue = authoritativeAllocationSaleValue(row);
    const cost = allocationCost(row);
    current.revenue += revenue;
    current.cost += cost;
    current.profit += revenue - cost;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.profit - a.profit)
    .map((row, index) => {
      const margin = row.revenue ? (row.profit / row.revenue) * 100 : 0;
      return {
        sku: String(index + 1).padStart(3, "0"),
        description: row.supplier,
        unit: row.source,
        quantity: row.units,
        unitPrice: row.cost,
        discount: row.revenue,
        taxRate: `${margin.toFixed(1)}% margin`,
        taxAmount: row.cost,
        lineTotal: row.profit,
        warehouse: row.supplier,
        batch: row.source,
        notes: `${period.label}. ${row.profit >= 0 ? "This source/supplier is generating positive gross profit." : "This source/supplier is generating a loss; review buying and selling prices."}`,
        details: {
          "#": String(index + 1),
          Source: row.source,
          Supplier: row.supplier,
          Period: period.label,
          Products: row.products.size.toString(),
          "Units sold": row.units.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
          Sales: money(row.revenue),
          "Supply cost": money(row.cost),
          "Gross profit": money(row.profit),
          Margin: `${margin.toFixed(1)}%`,
        },
      };
    });
}

type FinancialActivityRow = {
  account_code?: string | null;
  account_name?: string | null;
  account_class?: string | null;
  financial_statement_section?: string | null;
  debit_amount?: number | string | null;
  credit_amount?: number | string | null;
  natural_amount?: number | string | null;
};

type MonthlyProfitLossBucket = {
  key: string;
  label: string;
  revenue: number;
  costOfSales: number;
  expenses: number;
};

function monthKeyFromDate(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);
  return todayIsoDate().slice(0, 7);
}

function monthLabelFromKey(key: string) {
  return new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${key}-01T00:00:00.000Z`));
}

function nextMonthKey(key: string) {
  const [year, month] = key.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
}

function monthlyKeysBetween(startKey: string, endKey: string) {
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    current = nextMonthKey(current);
  }
  return keys;
}

async function monthlyProfitAndLossReportLines(): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const [{ data: invoices }, { data: allocations }, { data: expenses }] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("invoice_date, total_amount, status")
      .eq("business_id", businessId)
      .neq("status", "reversed")
      .order("invoice_date", { ascending: true })
      .limit(20000),
    supabase
      .from("sales_source_allocations")
      .select("allocated_at, quantity, unit_cost, total_cost")
      .eq("business_id", businessId)
      .order("allocated_at", { ascending: true })
      .limit(20000),
    supabase
      .from("expenses")
      .select("expense_date, amount, tax_amount, total_paid")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: true })
      .limit(20000),
  ]);

  const transactionMonths = [
    ...(invoices ?? []).map((row) => monthKeyFromDate(row.invoice_date)),
    ...(allocations ?? []).map((row) => monthKeyFromDate(row.allocated_at)),
    ...(expenses ?? []).map((row) => monthKeyFromDate(row.expense_date)),
  ].filter(Boolean);

  if (!transactionMonths.length) return [financialEmptyLine("No posted sales, stock cost allocations or expenses have been found for this business yet.")];

  const startKey = transactionMonths.sort()[0];
  const endKey = todayIsoDate().slice(0, 7);
  const buckets = new Map<string, MonthlyProfitLossBucket>();
  for (const key of monthlyKeysBetween(startKey, endKey)) {
    buckets.set(key, { key, label: monthLabelFromKey(key), revenue: 0, costOfSales: 0, expenses: 0 });
  }

  for (const invoice of invoices ?? []) {
    const key = monthKeyFromDate(invoice.invoice_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += numberValue(invoice.total_amount);
  }

  for (const allocation of allocations ?? []) {
    const key = monthKeyFromDate(allocation.allocated_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.costOfSales += allocationCost(allocation);
  }

  for (const expense of expenses ?? []) {
    const key = monthKeyFromDate(expense.expense_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const totalPaid = numberValue(expense.total_paid);
    bucket.expenses += totalPaid || numberValue(expense.amount) + numberValue(expense.tax_amount);
  }

  return Array.from(buckets.values()).map((bucket, index) => {
    const grossProfit = bucket.revenue - bucket.costOfSales;
    const netProfit = grossProfit - bucket.expenses;
    const margin = bucket.revenue ? (netProfit / bucket.revenue) * 100 : 0;
    return {
      sku: `P&L-${bucket.key}`,
      description: bucket.label,
      unit: "Month",
      quantity: index + 1,
      unitPrice: bucket.revenue,
      discount: bucket.costOfSales,
      taxRate: `${margin.toFixed(1)}% net margin`,
      taxAmount: bucket.expenses,
      lineTotal: netProfit,
      warehouse: "Finance",
      batch: "Monthly Profit and Loss",
      notes:
        netProfit >= 0
          ? `${bucket.label} is profitable after received-stock costs and recorded expenses.`
          : `${bucket.label} is showing a loss after received-stock costs and recorded expenses.`,
      details: {
        "Statement type": "Monthly profit and loss",
        Month: bucket.label,
        "Month key": bucket.key,
        Sales: money(bucket.revenue),
        "Cost of goods sold": money(bucket.costOfSales),
        "Gross profit": money(grossProfit),
        "Operating expenses": money(bucket.expenses),
        "Net profit / loss": money(netProfit),
        "Net margin": `${margin.toFixed(1)}%`,
        Section: "Monthly P&L",
        "Account Code": "",
        "Account Name": bucket.label,
        Class: "monthly-summary",
        Debit: money(bucket.costOfSales + bucket.expenses),
        Credit: money(bucket.revenue),
        Amount: money(netProfit),
        Closing: money(netProfit),
        "Closing Debit": money(netProfit < 0 ? Math.abs(netProfit) : 0),
        "Closing Credit": money(netProfit > 0 ? netProfit : 0),
        Classification: "Profit and Loss",
        "Statement line": "Sales less received-stock cost of goods sold and posted operating expenses.",
      },
    };
  });
}

function financialEmptyLine(message: string): ReportLine {
  return {
    sku: "LEDGER",
    description: message,
    unit: "Statement",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxRate: "No posted ledger activity",
    taxAmount: 0,
    lineTotal: 0,
    warehouse: "Finance",
    batch: "No activity",
    notes: "Post journals, sales, purchases, receipts or payments to populate this statement.",
    details: {
      Section: "No activity",
      "Account Code": "LEDGER",
      "Account Name": message,
      Debit: money(0),
      Credit: money(0),
      Amount: money(0),
      "Statement line": "No posted ledger activity",
      Class: "No activity",
      Closing: money(0),
      "Closing Debit": money(0),
      "Closing Credit": money(0),
      Classification: "No activity",
    },
  };
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unclassified";
}

function financialSection(row: { accountClass: string; statementSection: string }) {
  return titleCase(row.statementSection || row.accountClass || "Unclassified");
}

function financialLine(row: {
  accountCode: string;
  accountName: string;
  accountClass: string;
  statementSection: string;
  debit: number;
  credit: number;
  natural: number;
}): ReportLine {
  const closingDebit = row.natural >= 0 ? row.natural : 0;
  const closingCredit = row.natural < 0 ? Math.abs(row.natural) : 0;
  const section = financialSection(row);
  return {
    sku: row.accountCode,
    description: row.accountName,
    unit: "Account",
    quantity: 1,
    unitPrice: row.debit,
    discount: row.credit,
    taxRate: row.accountClass || "ledger",
    taxAmount: row.credit,
    lineTotal: row.natural,
    warehouse: "Finance",
    batch: section,
    notes: `${section} account from posted journal activity.`,
    details: {
      Section: section,
      "Account Code": row.accountCode,
      "Account Name": row.accountName,
      Class: row.accountClass || "ledger",
      Debit: money(row.debit),
      Credit: money(row.credit),
      Amount: money(row.natural),
      Closing: money(row.natural),
      "Closing Debit": money(closingDebit),
      "Closing Credit": money(closingCredit),
      Classification: row.statementSection || row.accountClass || "ledger",
      "Statement line": row.natural < 0 ? "Deduct" : "Add",
    },
  };
}

function financialSummaryLine(label: string, amount: number, section: string, note: string): ReportLine {
  return {
    sku: "TOTAL",
    description: label,
    unit: "Summary",
    quantity: 1,
    unitPrice: amount > 0 ? amount : 0,
    discount: amount < 0 ? Math.abs(amount) : 0,
    taxRate: amount < 0 ? "Loss / deduction" : "Positive balance",
    taxAmount: amount < 0 ? Math.abs(amount) : 0,
    lineTotal: amount,
    warehouse: "Finance",
    batch: section,
    notes: note,
    details: {
      Section: section,
      "Account Code": "",
      "Account Name": label,
      Class: "summary",
      Debit: money(amount > 0 ? amount : 0),
      Credit: money(amount < 0 ? Math.abs(amount) : 0),
      Amount: money(amount),
      Closing: money(amount),
      "Closing Debit": money(amount > 0 ? amount : 0),
      "Closing Credit": money(amount < 0 ? Math.abs(amount) : 0),
      Classification: section,
      "Statement line": note,
    },
  };
}

async function financialStatementReportLines(processName: string): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const lower = processName.toLowerCase();
  if (lower.includes("profit and loss") || lower.includes("income statement")) {
    return monthlyProfitAndLossReportLines();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("financial_statement_account_activity")
    .select("account_code, account_name, account_class, financial_statement_section, debit_amount, credit_amount, natural_amount")
    .eq("business_id", businessId)
    .limit(2000);

  const rows = ((data ?? []) as FinancialActivityRow[])
    .map((row) => ({
      accountCode: String(row.account_code ?? "0000"),
      accountName: String(row.account_name ?? "Unnamed account"),
      accountClass: String(row.account_class ?? "").toLowerCase(),
      statementSection: String(row.financial_statement_section ?? "").toLowerCase(),
      debit: numberValue(row.debit_amount),
      credit: numberValue(row.credit_amount),
      natural: numberValue(row.natural_amount),
    }))
    .sort((a, b) => `${a.statementSection}-${a.accountCode}-${a.accountName}`.localeCompare(`${b.statementSection}-${b.accountCode}-${b.accountName}`));

  if (!rows.length) return [financialEmptyLine("No posted ledger activity has been found for this business yet.")];

  const revenueRows = rows.filter((row) => row.accountClass.includes("revenue") || row.accountClass.includes("income") || row.statementSection.includes("revenue") || row.statementSection.includes("income"));
  const costRows = rows.filter((row) => row.accountClass.includes("cost") || row.statementSection.includes("cost"));
  const expenseRows = rows.filter((row) => row.accountClass.includes("expense") || row.statementSection.includes("expense"));

  if (lower.includes("trial balance")) return rows.map(financialLine);

  if (lower.includes("balance sheet")) {
    const assetRows = rows.filter((row) => row.accountClass.includes("asset") || row.statementSection.includes("asset"));
    const liabilityRows = rows.filter((row) => row.accountClass.includes("liabil") || row.statementSection.includes("liabil"));
    const equityRows = rows.filter((row) => row.accountClass.includes("equity") || row.statementSection.includes("equity"));
    const assets = assetRows.reduce((sum, row) => sum + row.natural, 0);
    const liabilities = liabilityRows.reduce((sum, row) => sum + Math.abs(row.natural), 0);
    const equity = equityRows.reduce((sum, row) => sum + Math.abs(row.natural), 0);
    const profit =
      revenueRows.reduce((sum, row) => sum + row.natural, 0) -
      costRows.reduce((sum, row) => sum + Math.abs(row.natural), 0) -
      expenseRows.reduce((sum, row) => sum + Math.abs(row.natural), 0);
    const balanceCheck = assets - liabilities - equity - profit;
    return [
      ...assetRows.map(financialLine),
      financialSummaryLine("Total Assets", assets, "Assets", "Resources controlled by the business."),
      ...liabilityRows.map(financialLine),
      financialSummaryLine("Total Liabilities", -liabilities, "Liabilities", "Obligations owed by the business."),
      ...equityRows.map(financialLine),
      financialSummaryLine("Owner Equity", -equity, "Equity", "Owner capital and retained equity balances."),
      financialSummaryLine("Current Year Profit / Loss", profit, "Equity", "Profit or loss carried into equity for statement balance."),
      financialSummaryLine("Balance Check", balanceCheck, "Control", "Should be zero when posted accounts are fully balanced."),
    ];
  }

  return rows.map(financialLine);
}

type SalesInvoiceRow = {
  id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  subtotal?: number | string | null;
  tax_total?: number | string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
  balance_due?: number | string | null;
  status?: string | null;
  delivery_status?: string | null;
  created_at?: string | null;
  customers?:
    | { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null }
    | { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null }[]
    | null;
  branches?: { branch_name?: string | null; branch_code?: string | null } | { branch_name?: string | null; branch_code?: string | null }[] | null;
};

type SalesItemRow = {
  id?: string | null;
  invoice_id?: string | null;
  product_id?: string | null;
  invoice_quantity?: number | string | null;
  unit_price?: number | string | null;
  tax_amount?: number | string | null;
  line_total?: number | string | null;
  products?: { product_name?: string | null; product_code?: string | null; sku?: string | null; standard_cost?: number | string | null } | { product_name?: string | null; product_code?: string | null; sku?: string | null; standard_cost?: number | string | null }[] | null;
};

type CustomerPaymentRow = {
  id: string;
  customer_id?: string | null;
  payment_number?: string | null;
  payment_date?: string | null;
  amount_received?: number | string | null;
  status?: string | null;
  transaction_reference?: string | null;
  payer_name?: string | null;
  payer_phone?: string | null;
  customers?:
    | { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null }
    | { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null; phone?: string | null }[]
    | null;
};

type KraEtrInvoiceRow = SalesInvoiceRow & {
  customers?: { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null } | { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null }[] | null;
};

type ExternalTaxDocumentRow = {
  source_document_id?: string | null;
  control_unit_invoice_number?: string | null;
  external_document_number?: string | null;
  external_receipt_number?: string | null;
  submission_status?: string | null;
};

type GoodsReceivedItemRow = {
  grn_id?: string | null;
  supplier_batch?: string | null;
  expiry_date?: string | null;
  delivered_quantity?: number | string | null;
  accepted_quantity?: number | string | null;
  rejected_quantity?: number | string | null;
  unit_cost?: number | string | null;
  source_type?: string | null;
  source_reason?: string | null;
  products?: { product_name?: string | null; product_code?: string | null; sku?: string | null } | { product_name?: string | null; product_code?: string | null; sku?: string | null }[] | null;
};

type GoodsReceivedNoteRow = {
  id?: string | null;
  grn_number?: string | null;
  receipt_date?: string | null;
  supplier_delivery_note_number?: string | null;
  status?: string | null;
  suppliers?: { legal_name?: string | null; trading_name?: string | null; supplier_code?: string | null } | { legal_name?: string | null; trading_name?: string | null; supplier_code?: string | null }[] | null;
};

function dateKey(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : todayIsoDate();
}

function dayName(value: string) {
  return new Intl.DateTimeFormat("en-KE", { weekday: "short", timeZone: "Africa/Nairobi" }).format(new Date(`${value}T00:00:00.000Z`)).toUpperCase();
}

function monthKey(value: string | null | undefined) {
  return new Intl.DateTimeFormat("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${dateKey(value)}T00:00:00.000Z`));
}

function kraEtrMonthlyWindow() {
  const today = todayIsoDate();
  const [year, month] = today.split("-");
  return {
    label: `1-${19} ${new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${year}-${month}-01T00:00:00.000Z`))}`,
    start: `${year}-${month}-01`,
    end: `${year}-${month}-19`,
  };
}

function quarterKey(value: string | null | undefined) {
  const date = new Date(`${dateKey(value)}T00:00:00.000Z`);
  return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function hourKey(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Nairobi" }).format(date).slice(0, 2) + ":00";
}

function cleanDateParam(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function salesPeriodWindow(period: string | null, searchParams?: URLSearchParams) {
  const explicitStart = cleanDateParam(searchParams?.get("from") ?? searchParams?.get("startDate") ?? searchParams?.get("dateFrom"));
  const explicitEnd = cleanDateParam(searchParams?.get("to") ?? searchParams?.get("endDate") ?? searchParams?.get("dateTo"));
  if (explicitStart || explicitEnd) {
    const today = todayIsoDate();
    const start = explicitStart ?? explicitEnd ?? today;
    const end = explicitEnd ?? explicitStart ?? today;
    return {
      label: start === end ? start : `${start} to ${end}`,
      start: start <= end ? start : end,
      end: start <= end ? end : start,
    };
  }

  const today = todayIsoDate();
  const lower = String(period ?? "").toLowerCase();
  if (lower.includes("annual") || lower.includes("year")) return { label: "This year", start: `${today.slice(0, 4)}-01-01`, end: today };
  if (lower.includes("month")) return { label: "This month", start: `${today.slice(0, 7)}-01`, end: today };
  if (lower.includes("week")) return { label: "This week", start: startOfWeekDate(today), end: today };
  return { label: "Today", start: today, end: today };
}

function relatedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

type SalesSourceAllocationRow = {
  sales_invoice_id?: string | null;
  sales_invoice_item_id?: string | null;
  product_id?: string | null;
  source_type?: string | null;
  source_supplier_name?: string | null;
  total_cost?: number | string | null;
  sale_value?: number | string | null;
  sale_unit_price?: number | string | null;
  unit_cost?: number | string | null;
  quantity?: number | string | null;
};

async function salesOperationalData(searchParams?: URLSearchParams) {
  const businessId = await activeReportBusinessId();
  if (!businessId) return { invoices: [] as SalesInvoiceRow[], items: [] as SalesItemRow[], allocations: [] as SalesSourceAllocationRow[], period: salesPeriodWindow(searchParams?.get("period") ?? null, searchParams) };

  const supabase = await createSupabaseServerClient();
  const period = salesPeriodWindow(searchParams?.get("period") ?? null, searchParams);
  const requestedCustomerId = searchParams?.get("customerId");
  let invoiceQuery = supabase
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, subtotal, tax_total, total_amount, amount_paid, balance_due, status, delivery_status, created_at, customers(customer_name, customer_code), branches(branch_name, branch_code)")
      .eq("business_id", businessId)
      .neq("status", "reversed")
      .gte("invoice_date", period.start)
      .lte("invoice_date", period.end)
      .order("invoice_date", { ascending: true })
      .limit(3000);
  if (requestedCustomerId && requestedCustomerId !== "all") invoiceQuery = invoiceQuery.eq("customer_id", requestedCustomerId);

  const { data: invoices } = await invoiceQuery;
  const invoiceRows = (invoices ?? []) as SalesInvoiceRow[];
  const invoiceIds = invoiceRows.map((invoice) => invoice.id).filter(Boolean) as string[];
  if (!invoiceIds.length) return { invoices: invoiceRows, items: [] as SalesItemRow[], allocations: [] as SalesSourceAllocationRow[], period };

  const [{ data: items }, { data: allocations }] = await Promise.all([
    supabase
      .from("sales_invoice_items")
      .select("id, invoice_id, product_id, invoice_quantity, unit_price, tax_amount, line_total, products(product_name, product_code, sku, standard_cost)")
      .eq("business_id", businessId)
      .in("invoice_id", invoiceIds)
      .limit(10000),
    supabase
      .from("sales_source_allocations")
      .select("sales_invoice_id, sales_invoice_item_id, product_id, source_type, source_supplier_name, quantity, unit_cost, total_cost, sale_unit_price, sale_value")
      .eq("business_id", businessId)
      .in("sales_invoice_id", invoiceIds)
      .limit(10000),
  ]);

  return {
    invoices: invoiceRows,
    items: (items ?? []) as SalesItemRow[],
    allocations: (allocations ?? []) as SalesSourceAllocationRow[],
    period,
  };
}

async function kraEtrSalesReportLines(): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  const period = kraEtrMonthlyWindow();
  const [{ data: invoices }, { data: taxConfig }] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, subtotal, tax_total, total_amount, status, customers(customer_name, customer_code, kra_pin)")
      .eq("business_id", businessId)
      .gte("invoice_date", period.start)
      .lte("invoice_date", period.end)
      .neq("status", "draft")
      .order("invoice_date", { ascending: true })
      .limit(1000),
    supabase
      .from("tax_integration_configurations")
      .select("device_identifier, branch_identifier, taxpayer_identifier, integration_status")
      .eq("business_id", businessId)
      .eq("active", true)
      .limit(1),
  ]);

  const invoiceRows = ((invoices ?? []) as KraEtrInvoiceRow[]).filter((invoice) => {
    const customer = relatedOne(invoice.customers) as { kra_pin?: string | null } | null;
    return Boolean(String(customer?.kra_pin ?? "").trim());
  });
  const invoiceIds = invoiceRows.map((invoice) => invoice.id).filter(Boolean);
  if (!invoiceIds.length) {
    return [
      {
        sku: "KRA-ETR",
        description: `No posted KRA PIN customer sales found for ${period.label}.`,
        unit: "Monthly VAT prep",
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        taxRate: "No rows",
        taxAmount: 0,
        lineTotal: 0,
        warehouse: "Tax workspace",
        batch: period.label,
        notes: "Post sales invoices for customers with KRA PINs dated within the 1st to 19th VAT-preparation window to populate this report.",
        details: {
          "Sr. No": "-",
          "Customer KRA PIN": "No KRA PIN customer sales",
          "Customer Name": "No KRA PIN customer sales",
          "KRA Device No.": "Not configured",
          "Invoice Date": `${period.start} to ${period.end}`,
          "CUI Invoice No.": "No KRA PIN customer sales",
          "Item Description": "No posted sales for KRA PIN customers in this VAT-preparation window",
          "Exclusive Amount": money(0),
          VAT: money(0),
          "Inclusive Amount": money(0),
        },
      },
    ];
  }

  const [{ data: items }, { data: externalDocs }] = await Promise.all([
    supabase
      .from("sales_invoice_items")
      .select("invoice_id, product_id, invoice_quantity, unit_price, tax_amount, line_total, products(product_name, product_code, sku)")
      .eq("business_id", businessId)
      .in("invoice_id", invoiceIds)
      .limit(3000),
    supabase
      .from("external_tax_documents")
      .select("source_document_id, control_unit_invoice_number, external_document_number, external_receipt_number, submission_status")
      .eq("business_id", businessId)
      .eq("source_document_type", "sales_invoice")
      .in("source_document_id", invoiceIds)
      .limit(1000),
  ]);

  const invoiceById = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const taxDocByInvoice = new Map(
    ((externalDocs ?? []) as ExternalTaxDocumentRow[]).map((document) => [String(document.source_document_id), document]),
  );
  const config = Array.isArray(taxConfig) ? taxConfig[0] : null;
  const deviceNumber =
    typeof config?.device_identifier === "string" && config.device_identifier.trim()
      ? config.device_identifier.trim()
      : typeof config?.branch_identifier === "string" && config.branch_identifier.trim()
        ? config.branch_identifier.trim()
        : "Not configured";

  return ((items ?? []) as SalesItemRow[])
    .map((item, index) => {
      const invoice = invoiceById.get(String(item.invoice_id));
      const customer = relatedOne(invoice?.customers) as { customer_name?: string | null; customer_code?: string | null; kra_pin?: string | null } | null;
      const product = relatedOne(item.products);
      const taxDocument = taxDocByInvoice.get(String(item.invoice_id));
      const tax = numberValue(item.tax_amount);
      const inclusive = numberValue(item.line_total);
      const exclusive = Math.max(0, inclusive - tax);
      const cui =
        taxDocument?.control_unit_invoice_number ||
        taxDocument?.external_document_number ||
        taxDocument?.external_receipt_number ||
        invoice?.invoice_number ||
        "CUI not recorded";
      const itemDescription = String(product?.product_name ?? product?.product_code ?? "Sold item");

      return {
        sku: String(index + 1),
        description: itemDescription,
        unit: "ETR sale",
        quantity: numberValue(item.invoice_quantity),
        unitPrice: exclusive,
        discount: 0,
        taxRate: exclusive ? `${((tax / exclusive) * 100).toFixed(1)}% VAT` : "0% VAT",
        taxAmount: tax,
        lineTotal: inclusive,
        warehouse: "KRA VAT return support",
        batch: String(taxDocument?.submission_status ?? invoice?.status ?? "posted"),
        notes: `Invoice ${String(invoice?.invoice_number ?? "not recorded")} for ${String(customer?.customer_name ?? "Walk-in customer")}. Period ${period.label}.`,
        details: {
          "Sr. No": String(index + 1),
          "Customer KRA PIN": String(customer?.kra_pin ?? "Not provided"),
          "Customer Name": String(customer?.customer_name ?? "Walk-in customer"),
          "KRA Device No.": deviceNumber,
          "Invoice Date": invoice ? dateKey(invoice.invoice_date) : todayIsoDate(),
          "CUI Invoice No.": String(cui),
          "Item Description": itemDescription,
          "Exclusive Amount": money(exclusive),
          VAT: money(tax),
          "Inclusive Amount": money(inclusive),
          "Invoice No.": String(invoice?.invoice_number ?? ""),
          "ETR Status": String(taxDocument?.submission_status ?? "Manual / not submitted"),
          "VAT Prep Period": `${period.start} to ${period.end}`,
        },
      };
    })
    .filter((line) => line.quantity > 0 || line.lineTotal > 0);
}

function invoiceBaseLine(invoice: SalesInvoiceRow, index: number): ReportLine {
  const customer = relatedOne(invoice.customers);
  const branch = relatedOne(invoice.branches);
  const total = numberValue(invoice.total_amount);
  const tax = numberValue(invoice.tax_total);
  const subtotal = numberValue(invoice.subtotal) || Math.max(0, total - tax);
  return {
    sku: String(invoice.invoice_number ?? `SALE-${index + 1}`),
    description: String(customer?.customer_name ?? "Walk-in customer"),
    unit: "Invoice",
    quantity: 1,
    unitPrice: subtotal,
    discount: numberValue(invoice.amount_paid),
    taxRate: tax ? `${((tax / Math.max(subtotal, 1)) * 100).toFixed(1)}% VAT` : "No VAT",
    taxAmount: tax,
    lineTotal: total,
    warehouse: String(branch?.branch_name ?? branch?.branch_code ?? "Main workspace"),
    batch: String(invoice.status ?? "posted"),
    notes: `Delivery: ${String(invoice.delivery_status ?? "not recorded")}. Balance: ${money(numberValue(invoice.balance_due))}.`,
    details: {
      "Invoice no.": String(invoice.invoice_number ?? ""),
      Date: dateKey(invoice.invoice_date),
      Customer: String(customer?.customer_name ?? "Walk-in customer"),
      Branch: String(branch?.branch_name ?? branch?.branch_code ?? "Main workspace"),
      "Sales amount": money(subtotal),
      "Sales tax": money(tax),
      "Sales total": money(total),
      "Amount paid": money(numberValue(invoice.amount_paid)),
      "Balance due": money(numberValue(invoice.balance_due)),
      Status: String(invoice.status ?? "posted"),
      "Delivery status": String(invoice.delivery_status ?? "not recorded"),
    },
  };
}

function itemBaseLine(item: SalesItemRow, invoice: SalesInvoiceRow | undefined, index: number): ReportLine {
  const product = relatedOne(item.products);
  const quantity = numberValue(item.invoice_quantity);
  const unitPrice = numberValue(item.unit_price);
  const total = numberValue(item.line_total);
  const amountPaid = numberValue(invoice?.amount_paid);
  const balanceDue = numberValue(invoice?.balance_due);
  return {
    sku: String(product?.sku ?? product?.product_code ?? `ITEM-${index + 1}`),
    description: String(product?.product_name ?? "Sold item"),
    unit: "Unit",
    quantity,
    unitPrice,
    discount: 0,
    taxRate: "VAT incl.",
    taxAmount: 0,
    lineTotal: total,
    warehouse: invoice ? dateKey(invoice.invoice_date) : "Posted sales",
    batch: String(invoice?.invoice_number ?? "Invoice"),
    notes: `Customer: ${String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer")}. Selling price is VAT-inclusive where VAT applies.`,
    details: {
      "Item no": String(product?.product_code ?? product?.sku ?? ""),
      "Item name": String(product?.product_name ?? "Sold item"),
      "Item description": String(product?.product_name ?? "Sold item"),
      "Inclusive Unit Price": money(unitPrice),
      "Unit Price": money(unitPrice),
      Price: money(unitPrice),
      Qty: quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      Amount: money(total),
      "Amount Payable": money(total),
      "Tax rate": "VAT included where applicable",
      Tax: money(0),
      "Total payable": money(total),
      "Amount Paid": money(amountPaid),
      "Balance Due": money(balanceDue),
      "Invoice no.": String(invoice?.invoice_number ?? ""),
      Date: invoice ? dateKey(invoice.invoice_date) : todayIsoDate(),
      Customer: String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer"),
      "Invoice subtotal": money(numberValue(invoice?.total_amount)),
      "Invoice tax": money(0),
      "Invoice total": money(numberValue(invoice?.total_amount)),
      "Amount paid": money(amountPaid),
      "Balance due": money(balanceDue),
      "Payment status": String(invoice?.status ?? "posted"),
    },
  };
}

function productSizeGroup(description: string) {
  const value = description.toLowerCase().replace(/\s+/g, " ");
  const packMatch = value.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|l|lt|lts|litre|liter|litres|liters)\b/);
  const directMatch = value.match(/(\d+(?:\.\d+)?)\s*(ml|l|lt|lts|litre|liter|litres|liters)\b/);
  const match = packMatch
    ? { amount: Number(packMatch[2]), unit: packMatch[3] }
    : directMatch
      ? { amount: Number(directMatch[1]), unit: directMatch[2] }
      : null;
  if (!match || !Number.isFinite(match.amount)) return { rank: 999999, label: "other" };
  const rank = match.unit.startsWith("l") ? match.amount * 1000 : match.amount;
  return { rank, label: `${rank}ml` };
}

function sortInvoiceLinesForPrint(lines: ReportLine[]) {
  return [...lines].sort((a, b) => {
    const aGroup = productSizeGroup(`${a.description} ${a.sku}`);
    const bGroup = productSizeGroup(`${b.description} ${b.sku}`);
    if (aGroup.rank !== bGroup.rank) return aGroup.rank - bGroup.rank;
    return a.description.localeCompare(b.description);
  });
}

async function salesInvoiceDocumentLines(invoiceId: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId || !invoiceId) return [];

  const supabase = await createSupabaseServerClient();
  const [invoiceResult, itemResult] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, subtotal, tax_total, total_amount, amount_paid, balance_due, status, delivery_status, created_at, customers(customer_name, customer_code), branches(branch_name, branch_code)")
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .limit(1),
    supabase
      .from("sales_invoice_items")
      .select("invoice_id, product_id, invoice_quantity, unit_price, tax_amount, line_total, products(product_name, product_code, sku, standard_cost)")
      .eq("business_id", businessId)
      .eq("invoice_id", invoiceId)
      .order("id", { ascending: true })
      .limit(200),
  ]);
  if (invoiceResult.error) {
    console.error("Sales invoice export invoice query failed", {
      invoiceId,
      businessId,
      message: invoiceResult.error.message,
    });
    throw new Error(`Could not load this invoice. ${invoiceResult.error.message}`);
  }
  if (itemResult.error) {
    console.error("Sales invoice export item query failed", {
      invoiceId,
      businessId,
      message: itemResult.error.message,
    });
    throw new Error(`Could not load the invoice line items. ${itemResult.error.message}`);
  }
  const invoice = ((invoiceResult.data ?? [])[0] ?? undefined) as SalesInvoiceRow | undefined;
  if (!invoice) {
    console.error("Sales invoice export invoice not found", { invoiceId, businessId });
    throw new Error("This invoice was not found in the current business workspace. Open Sales History and try downloading it again.");
  }
  return sortInvoiceLinesForPrint(((itemResult.data ?? []) as SalesItemRow[]).map((item, index) => itemBaseLine(item, invoice, index)));
}

async function goodsReceivedDocumentLines(grnId: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId || !grnId) return [];

  const supabase = await createSupabaseServerClient();
  const [{ data: grns }, { data: items }] = await Promise.all([
    supabase
      .from("goods_received_notes")
      .select("id, grn_number, receipt_date, supplier_delivery_note_number, status, suppliers(legal_name, trading_name, supplier_code)")
      .eq("business_id", businessId)
      .eq("id", grnId)
      .limit(1),
    supabase
      .from("goods_received_note_items")
      .select("grn_id, supplier_batch, expiry_date, delivered_quantity, accepted_quantity, rejected_quantity, unit_cost, source_type, source_reason, products(product_name, product_code, sku)")
      .eq("business_id", businessId)
      .eq("grn_id", grnId)
      .order("created_at", { ascending: true })
      .limit(300),
  ]);
  const grn = ((grns ?? [])[0] ?? undefined) as GoodsReceivedNoteRow | undefined;
  const supplier = relatedOne(grn?.suppliers);
  const supplierName = String(supplier?.trading_name ?? supplier?.legal_name ?? "Supplier not recorded");
  const grnNumber = String(grn?.grn_number ?? grnId);
  const receiptDate = dateKey(grn?.receipt_date);
  const supplierDeliveryNote = String(grn?.supplier_delivery_note_number ?? "Not provided");

  return ((items ?? []) as GoodsReceivedItemRow[]).map((item, index) => {
    const product = relatedOne(item.products);
    const accepted = numberValue(item.accepted_quantity);
    const delivered = numberValue(item.delivered_quantity);
    const rejected = numberValue(item.rejected_quantity);
    const unitCost = numberValue(item.unit_cost);
    const total = accepted * unitCost;
    return {
      sku: String(product?.sku ?? product?.product_code ?? `GRN-${index + 1}`),
      description: String(product?.product_name ?? "Received product"),
      unit: "Unit",
      quantity: accepted,
      unitPrice: unitCost,
      discount: 0,
      taxRate: "Receipt",
      taxAmount: 0,
      lineTotal: total,
      warehouse: sourceLabel(item.source_type),
      batch: String(item.supplier_batch ?? "No batch"),
      notes: `Delivered ${delivered.toLocaleString("en-KE", { maximumFractionDigits: 2 })}; accepted ${accepted.toLocaleString("en-KE", { maximumFractionDigits: 2 })}; rejected ${rejected.toLocaleString("en-KE", { maximumFractionDigits: 2 })}.${item.expiry_date ? ` Expiry ${item.expiry_date}.` : ""}`,
      details: {
        "#": String(index + 1),
        "Item code": String(product?.product_code ?? product?.sku ?? ""),
        Description: String(product?.product_name ?? "Received product"),
        "Qty delivered": delivered.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Qty accepted": accepted.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Qty rejected": rejected.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Unit cost": money(unitCost),
        "Line value": money(total),
        Supplier: supplierName,
        "Supplier code": String(supplier?.supplier_code ?? ""),
        "GRN no.": grnNumber,
        "Supplier delivery note": supplierDeliveryNote,
        "Receipt date": receiptDate,
        "GRN status": String(grn?.status ?? "posted"),
        Batch: String(item.supplier_batch ?? "Not provided"),
        Expiry: String(item.expiry_date ?? "Not applicable"),
        Source: sourceLabel(item.source_type),
        Notes: String(item.source_reason ?? "Received into stock"),
      },
    };
  });
}

function groupedSalesLines(invoices: SalesInvoiceRow[], groupBy: "day" | "hour" | "month" | "quarter" | "annual"): ReportLine[] {
  const groups = new Map<string, { revenue: number; tax: number; customers: Set<string>; invoices: number; paid: number; balance: number }>();
  for (const invoice of invoices) {
    const customer = String(relatedOne(invoice.customers)?.customer_name ?? "Walk-in customer");
    const key =
      groupBy === "hour"
        ? hourKey(invoice.created_at ?? invoice.invoice_date)
        : groupBy === "month"
          ? monthKey(invoice.invoice_date)
          : groupBy === "quarter"
            ? quarterKey(invoice.invoice_date)
            : groupBy === "annual"
              ? String(new Date(`${dateKey(invoice.invoice_date)}T00:00:00.000Z`).getUTCFullYear())
              : dateKey(invoice.invoice_date);
    const current = groups.get(key) ?? { revenue: 0, tax: 0, customers: new Set<string>(), invoices: 0, paid: 0, balance: 0 };
    current.revenue += numberValue(invoice.total_amount);
    current.tax += numberValue(invoice.tax_total);
    current.paid += numberValue(invoice.amount_paid);
    current.balance += numberValue(invoice.balance_due);
    current.invoices += 1;
    current.customers.add(customer);
    groups.set(key, current);
  }

  let previousRevenue = 0;
  let previousCustomers = 0;
  return Array.from(groups.entries()).map(([period, values]) => {
    const customers = values.customers.size;
    const aov = values.invoices ? values.revenue / values.invoices : 0;
    const revenueGrowth = previousRevenue ? ((values.revenue - previousRevenue) / previousRevenue) * 100 : 0;
    const customerGrowth = previousCustomers ? ((customers - previousCustomers) / previousCustomers) * 100 : 0;
    previousRevenue = values.revenue;
    previousCustomers = customers;
    return {
      sku: period,
      description: `Sales performance for ${period}`,
      unit: groupBy,
      quantity: values.invoices,
      unitPrice: aov,
      discount: values.paid,
      taxRate: `${revenueGrowth.toFixed(1)}% growth`,
      taxAmount: values.tax,
      lineTotal: values.revenue,
      warehouse: "All branches",
      batch: period,
      notes: values.balance > 0 ? `Follow up ${money(values.balance)} unpaid balance.` : "Collections are clean for this period.",
      details: {
        Period: period,
        Day: groupBy === "day" ? dayName(period) : period,
        Revenue: money(values.revenue),
        "Revenue (KES)": money(values.revenue),
        Customers: String(customers),
        "Customers (#)": String(customers),
        "Transaction count": String(values.invoices),
        "Average order value": money(aov),
        "Average order value (KES)": money(aov),
        "Revenue growth (%)": `${revenueGrowth.toFixed(1)}%`,
        "Customer growth (%)": `${customerGrowth.toFixed(1)}%`,
        "AOV growth (%)": "Review",
        "Sales tax": money(values.tax),
        "Amount paid": money(values.paid),
        "Balance due": money(values.balance),
        Target: money(0),
        Variance: money(values.revenue),
        Notes: values.balance > 0 ? "Collections pending" : "No balance due",
      },
    };
  });
}

function productSalesTrackingLines(items: SalesItemRow[], invoicesById: Map<string, SalesInvoiceRow>, allocations: SalesSourceAllocationRow[]): ReportLine[] {
  const profitByProduct = new Map<string, { profit: number; cost: number; saleValue: number; qty: number }>();
  for (const allocation of allocations) {
    const key = String(allocation.product_id ?? "unknown");
    const current = profitByProduct.get(key) ?? { profit: 0, cost: 0, saleValue: 0, qty: 0 };
    current.cost += allocationCost(allocation);
    current.saleValue += allocationSaleValue(allocation);
    current.qty += numberValue(allocation.quantity);
    current.profit = current.saleValue - current.cost;
    profitByProduct.set(key, current);
  }

  const grouped = new Map<string, { product: string; sku: string; qty: number; revenue: number; tax: number; cost: number; profit: number }>();
  for (const item of items) {
    const product = relatedOne(item.products);
    const key = String(item.product_id ?? product?.sku ?? product?.product_code ?? product?.product_name ?? "unknown");
    const current = grouped.get(key) ?? {
      product: String(product?.product_name ?? "Sold item"),
      sku: String(product?.sku ?? product?.product_code ?? key),
      qty: 0,
      revenue: 0,
      tax: 0,
      cost: 0,
      profit: 0,
    };
    current.qty += numberValue(item.invoice_quantity);
    current.revenue += numberValue(item.line_total);
    current.tax += numberValue(item.tax_amount);
    const allocation = profitByProduct.get(String(item.product_id ?? ""));
    current.cost = allocation?.cost ?? current.cost + numberValue(product?.standard_cost) * numberValue(item.invoice_quantity);
    current.profit = current.revenue - current.cost;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((row) => {
    const averageSelling = row.qty ? row.revenue / row.qty : 0;
    const averageCost = row.qty ? row.cost / row.qty : 0;
    const markup = averageCost ? ((averageSelling - averageCost) / averageCost) * 100 : 0;
    return {
      sku: row.sku,
      description: row.product,
      unit: "Unit",
      quantity: row.qty,
      unitPrice: averageCost,
      discount: averageSelling,
      taxRate: `${markup.toFixed(1)}% markup`,
      taxAmount: row.tax,
      lineTotal: row.revenue,
      warehouse: "All branches",
      batch: row.profit >= 0 ? "Profitable" : "Loss",
      notes: row.profit >= 0 ? "Product is generating positive gross profit." : "Review cost, pricing or discounts.",
      details: {
        "Product name": row.product,
        "Cost per item": money(averageCost),
        "Markup percentage": `${markup.toFixed(1)}%`,
        "Total sold": row.qty.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Total revenue": money(row.revenue),
        "Shipping charge per item": money(0),
        "Shipping cost per item": money(0),
        "Profit per item": money(row.qty ? row.profit / row.qty : 0),
        Returns: "0",
        "Total income": money(row.profit),
      },
    };
  });
}

function customerSalesAndProfitLines(
  items: SalesItemRow[],
  invoicesById: Map<string, SalesInvoiceRow>,
  allocations: SalesSourceAllocationRow[],
  periodLabel: string,
): ReportLine[] {
  type AllocationSummary = { cost: number; quantity: number; source: string; supplier: string };
  type AllocationChunk = AllocationSummary & { remainingQuantity: number; remainingCost: number };

  const itemCountByInvoiceProduct = new Map<string, number>();
  for (const item of items) {
    const key = `${item.invoice_id ?? ""}::${item.product_id ?? ""}`;
    itemCountByInvoiceProduct.set(key, (itemCountByInvoiceProduct.get(key) ?? 0) + 1);
  }

  const allocationByItem = new Map<string, AllocationSummary>();
  const allocationQueuesByInvoiceProduct = new Map<string, AllocationChunk[]>();
  for (const allocation of allocations) {
    const invoiceProductKey = `${allocation.sales_invoice_id ?? ""}::${allocation.product_id ?? ""}`;
    const quantity = numberValue(allocation.quantity);
    const cost = allocationCost(allocation);
    const source = sourceLabel(allocation.source_type);
    const supplier = String(allocation.source_supplier_name ?? "");

    if (allocation.sales_invoice_item_id) {
      const current = allocationByItem.get(allocation.sales_invoice_item_id) ?? { cost: 0, quantity: 0, source: "", supplier: "" };
      current.cost += cost;
      current.quantity += quantity;
      current.source = source || current.source;
      current.supplier = supplier || current.supplier;
      allocationByItem.set(allocation.sales_invoice_item_id, current);
    }

    const queue = allocationQueuesByInvoiceProduct.get(invoiceProductKey) ?? [];
    queue.push({ cost, quantity, source, supplier, remainingQuantity: quantity, remainingCost: cost });
    allocationQueuesByInvoiceProduct.set(invoiceProductKey, queue);
  }

  function consumeAllocation(invoiceProductKey: string, requestedQuantity: number): AllocationSummary | undefined {
    const queue = allocationQueuesByInvoiceProduct.get(invoiceProductKey);
    if (!queue?.length) return undefined;
    let remaining = requestedQuantity;
    const summary: AllocationSummary = { cost: 0, quantity: 0, source: "", supplier: "" };
    for (const chunk of queue) {
      if (remaining <= 0) break;
      if (chunk.remainingQuantity <= 0) continue;
      const take = Math.min(remaining, chunk.remainingQuantity);
      const unitCost = chunk.remainingQuantity ? chunk.remainingCost / chunk.remainingQuantity : 0;
      const takeCost = take * unitCost;
      summary.cost += takeCost;
      summary.quantity += take;
      summary.source = chunk.source || summary.source;
      summary.supplier = chunk.supplier || summary.supplier;
      chunk.remainingQuantity -= take;
      chunk.remainingCost -= takeCost;
      remaining -= take;
    }
    return summary.quantity > 0 ? summary : undefined;
  }

  return items.map((item, index) => {
    const invoice = invoicesById.get(String(item.invoice_id));
    const product = relatedOne(item.products);
    const quantity = numberValue(item.invoice_quantity);
    const revenue = numberValue(item.line_total);
    const invoiceProductKey = `${item.invoice_id ?? ""}::${item.product_id ?? ""}`;
    const hasRepeatedProductOnInvoice = (itemCountByInvoiceProduct.get(invoiceProductKey) ?? 0) > 1;
    const allocation =
      !hasRepeatedProductOnInvoice && item.id && allocationByItem.has(item.id)
        ? allocationByItem.get(item.id)
        : consumeAllocation(invoiceProductKey, quantity);
    const cost = allocation?.cost ?? 0;
    const profit = revenue - cost;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    return {
      sku: String(invoice?.invoice_number ?? `SALE-${index + 1}`),
      description: String(product?.product_name ?? "Sold item"),
      unit: "Sale line",
      quantity,
      unitPrice: numberValue(item.unit_price),
      discount: cost,
      taxRate: `${margin.toFixed(1)}% margin`,
      taxAmount: 0,
      lineTotal: profit,
      warehouse: String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer"),
      batch: allocation?.source || "FIFO source",
      notes: `${periodLabel}. Invoice ${String(invoice?.invoice_number ?? "not recorded")}. Supplier/source: ${allocation?.supplier || "from FIFO receipt"}.`,
      details: {
        "#": String(index + 1),
        Date: invoice ? dateKey(invoice.invoice_date) : todayIsoDate(),
        Customer: String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer"),
        "Invoice no.": String(invoice?.invoice_number ?? ""),
        Product: String(product?.product_name ?? "Sold item"),
        SKU: String(product?.sku ?? product?.product_code ?? ""),
        Qty: quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
        "Selling price": money(numberValue(item.unit_price)),
        Revenue: money(revenue),
        "Received stock cost": money(cost),
        "Gross profit": money(profit),
        Margin: `${margin.toFixed(1)}%`,
        Source: allocation?.source || "FIFO receipt",
        Supplier: allocation?.supplier || "Supplier from received stock",
        "Payment status": String(invoice?.status ?? "posted"),
        "Balance due": money(numberValue(invoice?.balance_due)),
      },
    };
  });
}

async function salesOperationalReportLines(processName: string, searchParams?: URLSearchParams): Promise<ReportLine[]> {
  const { invoices, items, allocations, period } = await salesOperationalData(searchParams);
  const invoicesById = new Map(invoices.map((invoice) => [String(invoice.id), invoice]));
  const lower = processName.toLowerCase();

  if (lower.includes("customer sales") || lower.includes("sales generation per customer")) return customerSalesAndProfitLines(items, invoicesById, allocations, period.label);
  if (lower.includes("tracking")) return productSalesTrackingLines(items, invoicesById, allocations);
  if (lower.includes("hourly")) return groupedSalesLines(invoices, "hour");
  if (lower.includes("daily sales kpi")) return groupedSalesLines(invoices, "day");
  if (lower.includes("quarterly")) return groupedSalesLines(invoices, "quarter");
  if (lower.includes("annual") || lower.includes("year-end")) return groupedSalesLines(invoices, "quarter");
  if (lower.includes("monthly") || lower.includes("dashboard")) return groupedSalesLines(invoices, "month");
  if (lower.includes("weekly sales activity")) {
    return groupedSalesLines(invoices, "day").map((line) => ({
      ...line,
      details: {
        Day: detailValue(line, "Day"),
        "Cold calls made": "0",
        "Follow-up calls": detailAmount(detailValue(line, "Balance due")) > 0 ? "1" : "0",
        "Emails sent": "0",
        "Meetings arranged": "0",
        "Visits completed": "0",
        "Leads generated": "0",
        "Deals closed": detailValue(line, "Transaction count"),
        "Products sold": String(line.quantity),
        "Sales revenue": detailValue(line, "Revenue"),
        "Target amount": money(0),
        Variance: detailValue(line, "Revenue"),
        Notes: detailValue(line, "Notes"),
      },
    }));
  }
  if (lower.includes("weekly sales call") || lower.includes("weekly route")) return groupedSalesLines(invoices, "day");
  if (lower.includes("deal loss")) {
    return [
      {
        sku: "NO-LOSS",
        description: "No lost-deal records posted",
        unit: "Reason",
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        taxRate: "0%",
        taxAmount: 0,
        lineTotal: 0,
        warehouse: "Sales pipeline",
        batch: "Loss reasons",
        notes: "Solva has no posted lost-deal workflow records for this period. Add opportunity/loss workflows to populate this report.",
        details: {
          "Loss reasons": "No lost-deal records posted",
          "Lost count": "0",
          "Lost value": money(0),
          "Recommended action": "Start recording rejected quotations, cancelled orders and lost opportunities.",
        },
      },
    ];
  }
  if (lower.includes("sales rep")) return items.map((item, index) => itemBaseLine(item, invoicesById.get(String(item.invoice_id)), index));
  if (lower.includes("basic daily")) return items.map((item, index) => itemBaseLine(item, invoicesById.get(String(item.invoice_id)), index));
  return invoices.map((invoice, index) => invoiceBaseLine(invoice, index));
}

async function workflowRecordReportLines(moduleName: string, processName: string): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("workflow_records")
    .select("module_name, process_name, reference_number, intent, status, record_payload, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (moduleName && moduleName !== "Solva Trade") query = query.eq("module_name", moduleName);
  if (processName && processName !== "Business Process") query = query.eq("process_name", processName);

  const { data } = await query;
  return (data ?? []).map((record) => {
    const payload = record.record_payload as { fields?: Record<string, { label?: string; value?: string }> } | null;
    const fields = payload?.fields ?? {};
    const amount = parseAmount(
      fields.total?.value ??
      fields.amount?.value ??
      fields.total_paid?.value ??
      fields.balance?.value ??
      fields.closing_cash?.value ??
      "0",
    );
    const quantity = parseAmount(fields.quantity?.value ?? fields.qty?.value ?? fields.rows?.value ?? "1") || 1;
    const primary =
      fields.customer?.value ||
      fields.supplier?.value ||
      fields.account?.value ||
      fields.product?.value ||
      fields.report?.value ||
      fields.category?.value ||
      record.process_name;

    return {
      sku: String(record.reference_number ?? "WORKFLOW"),
      description: String(primary),
      unit: "Record",
      quantity,
      unitPrice: amount,
      discount: 0,
      taxRate: String(record.status ?? "submitted"),
      taxAmount: parseAmount(fields.tax?.value ?? fields.vat?.value ?? "0"),
      lineTotal: amount,
      warehouse: String(fields.branch?.value ?? fields.warehouse?.value ?? record.module_name),
      batch: String(record.intent ?? record.process_name),
      notes: Object.values(fields)
        .slice(0, 4)
        .map((field) => `${field.label ?? "Field"}: ${field.value ?? ""}`)
        .join("; ") || "Saved workflow record.",
    };
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
}

function personInitials(name: string) {
  const compact = initials(name);
  return compact === "ST" ? "ST" : compact.split("").join(".");
}

function titleFor(report: Report) {
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) return "CUSTOMER SALES STATEMENT";
  if (isPlainCustomerInvoice(report)) return "INVOICE";
  return report.processName.toUpperCase();
}

const documentBlueprints: Record<string, DocumentBlueprint> = {
  "Product Profile": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Single product profile",
    table: "Product identity, pricing, tax, stock and reorder setup",
    intro: [
      ["Product Identity", "Shows the saved item name, SKU, barcode, brand, category and description.", "meta"],
      ["Pricing", "Shows standard cost, selling price and minimum selling controls saved for this tenant.", "note"],
      ["Stock Readiness", "Shows unit setup, pack conversion, balance, reorder and tracking settings.", "party"],
    ],
    headers: ["Item no.", "Item name", "Brand", "Category", "Base unit", "Cost per item", "Selling price", "Stock quantity", "VAT treatment", "Status"],
    signatures: ["Prepared by", "Business owner", "Date and stamp"],
    footerNote: "Use this product profile to verify the exact product setup before selling, purchasing or reporting.",
    emphasis: "control",
  },
  "New Product": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Product setup confirmation",
    table: "Saved product identity, pricing, tax and stock-control fields",
    intro: [
      ["Product Identity", "Confirms the product name, brand, category, code and units saved for this tenant.", "meta"],
      ["Pricing and Tax", "Shows the selling price and VAT treatment that should flow into sales, receipts and reports.", "note"],
      ["Stock Control", "Captures inventory tracking and reorder settings where they were provided.", "party"],
    ],
    headers: ["Item no.", "Item name", "Brand", "Category", "Base unit", "Selling price", "VAT treatment", "Status"],
    signatures: ["Created by", "Business owner", "Date and stamp"],
    footerNote: "Use this product setup confirmation to verify that the item is ready for purchasing, selling, stock control and reporting.",
    emphasis: "control",
  },
  "Edit Product": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Product update confirmation",
    table: "Updated product identity, pricing, tax and stock-control fields",
    intro: [
      ["Product Identity", "Confirms the product record that has been updated for this tenant.", "meta"],
      ["Pricing and Tax", "Shows the latest selling price and VAT treatment saved for future transactions.", "note"],
      ["Stock Control", "Captures the latest tracking, reorder and packaging settings where provided.", "party"],
    ],
    headers: ["Item no.", "Item name", "Brand", "Category", "Base unit", "Selling price", "VAT treatment", "Status"],
    signatures: ["Updated by", "Business owner", "Date and stamp"],
    footerNote: "Use this update confirmation to verify product setup changes before daily selling or purchasing starts.",
    emphasis: "control",
  },
  "Customer Profile": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Customer master-data profile",
    table: "Customer identity, contacts, credit, balances and activity",
    intro: [
      ["Customer Identity", "Confirms the customer profile and contact details held in the tenant workspace.", "meta"],
      ["Credit Control", "Summarizes credit terms, balances and follow-up status where available.", "note"],
      ["Audit Use", "Useful for customer file review, account opening and sales follow-up.", "party"],
    ],
    headers: ["Field", "Value", "Status", "Verified By", "Updated On", "Risk", "Notes"],
    signatures: ["Prepared by", "Customer / representative", "Owner / manager review"],
    footerNote: "Customer profiles preserve the details needed for sales, credit control, statements and follow-up.",
    emphasis: "control",
  },
  "Customer Price List": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Customer catalogue and price list",
    table: "Customer-specific product prices prepared for sharing",
    intro: [
      ["Customer", "Prepared for the selected customer before order confirmation.", "meta"],
      ["Price Control", "Prices can be adjusted for this catalogue without changing the default product master price.", "note"],
      ["VAT Basis", "Prices shown are VAT-inclusive where VAT applies, matching the way Solva Trade records selling prices.", "party"],
    ],
    headers: ["#", "Product", "SKU", "Customer price", "VAT treatment", "Available quantity"],
    signatures: ["Prepared by", "Customer", "Date"],
    footerNote: "Prices are customer-specific for this catalogue and should be confirmed before invoicing if market prices change.",
    emphasis: "report",
  },
  "Supplier Profile": {
    accent: "#92400E",
    soft: "#FFFBEB",
    label: "Supplier master-data profile",
    table: "Supplier identity, contacts, payment terms and purchasing context",
    intro: [
      ["Supplier Identity", "Confirms the supplier profile and contact details held in the tenant workspace.", "meta"],
      ["Procurement Control", "Summarizes supplier terms, price risk and purchasing context where available.", "note"],
      ["Audit Use", "Useful for supplier file review, purchase approvals and payment checks.", "party"],
    ],
    headers: ["Field", "Value", "Status", "Verified By", "Updated On", "Risk", "Notes"],
    signatures: ["Prepared by", "Supplier / representative", "Owner / procurement review"],
    footerNote: "Supplier profiles preserve the details needed for purchasing, GRNs, supplier statements and payments.",
    emphasis: "control",
  },
  "Daily Expense Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Daily office expense summary",
    table: "Expenses posted today by category, payee and cash source",
    intro: [
      ["Period", "Shows expenses recorded for today's business activity.", "meta"],
      ["Cash Control", "Amount spent is the actual money paid out. Input VAT is shown separately where captured.", "note"],
      ["Owner Use", "Useful for daily cash-up, petty cash review and expense follow-up.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this report to confirm today's recorded office expenses before closing the day.",
    emphasis: "report",
  },
  "Weekly Expense Report": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Weekly office expense summary",
    table: "Expenses posted this week by category, payee and cash source",
    intro: [
      ["Period", "Shows expenses recorded from Monday to today.", "meta"],
      ["Cost Review", "Helps identify fuel, wages, utilities and office costs that need attention.", "note"],
      ["Owner Use", "Useful for weekly business review and cash planning.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this report to review weekly office expenses and spot unusual cost movement.",
    emphasis: "report",
  },
  "Monthly Expense Report": {
    accent: "#7C3AED",
    soft: "#F5F3FF",
    label: "Monthly office expense summary",
    table: "Expenses posted this month by category, payee and cash source",
    intro: [
      ["Period", "Shows expenses recorded from the first day of the month to today.", "meta"],
      ["Management Use", "Supports monthly profit review, VAT input checks and budget control.", "note"],
      ["Accountant Use", "Gives the accountant a clean office expense schedule.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this report for monthly management review and accountant handover.",
    emphasis: "report",
  },
  "Annual Expense Report": {
    accent: "#92400E",
    soft: "#FFFBEB",
    label: "Annual office expense summary",
    table: "Expenses posted this year by category, payee and cash source",
    intro: [
      ["Period", "Shows expenses recorded from January 1 to today.", "meta"],
      ["Year Review", "Supports annual cost review, profit analysis and tax preparation.", "note"],
      ["Owner Use", "Useful for understanding where business money has gone across the year.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this report to review annual operating expenses and owner profit impact.",
    emphasis: "report",
  },
  "Office Expense Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Office expense schedule",
    table: "Current month office expenses by category and payee",
    intro: [
      ["Scope", "Shows office expenses recorded for the current month.", "meta"],
      ["Plain Terms", "Uses everyday categories such as fuel, rent, wages, electricity, internet and miscellaneous.", "note"],
      ["Use", "Prepared for owners, staff and accountants who need a clean expense schedule.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this schedule to confirm recorded office expenses without accounting jargon.",
    emphasis: "report",
  },
  "Expense Analysis Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Expense analysis",
    table: "Current month expenses with category, payee and cash source",
    intro: [
      ["Scope", "Shows expenses recorded for the current month.", "meta"],
      ["Analysis", "Useful for spotting high-cost categories and cash leaks.", "note"],
      ["Profit Impact", "Recorded expenses reduce the private owner profit view on the dashboard.", "party"],
    ],
    headers: ["Sr. no.", "Date", "Expense no.", "Expense type", "Paid to", "Paid from", "Amount spent", "Input VAT", "Total paid", "Status", "Notes"],
    signatures: ["Prepared by", "Reviewed by", "Date"],
    footerNote: "Use this report to understand which expense categories are affecting profit.",
    emphasis: "report",
  },
  "Product Master Report": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Complete product and inventory master",
    table: "Product setup, stock value, reorder and tax details",
    intro: [
      ["Inventory Value", "Total value is based on current stock balances and standard or average cost.", "meta"],
      ["Reorder Control", "Reorder status compares available quantity against the product reorder level.", "note"],
      ["Product Setup", "Includes units, pack conversion, VAT treatment, tracking flags and status.", "party"],
    ],
    headers: [
      "Reorder status",
      "Item no.",
      "Date of last order",
      "Item name",
      "Brand",
      "Category",
      "Vendor",
      "Stock location",
      "Description",
      "Base unit",
      "Pack conversion",
      "Cost per item",
      "Selling price",
      "Stock quantity",
      "Total value",
      "Reorder level",
      "Days per reorder",
      "Item reorder quantity",
      "VAT treatment",
      "Status",
    ],
    signatures: ["Prepared by", "Stock controller", "Owner / accountant review"],
    footerNote: "Use this report to review product setup completeness, stock value, reorder needs and tax treatment before purchasing or selling.",
    emphasis: "report",
  },
  "Weekly Inventory Report": {
    accent: "#0891B2",
    soft: "#ECFEFF",
    label: "Seven-day stock control snapshot",
    table: "Weekly item quantities, condition and value",
    intro: [
      ["Week Scope", "Shows stock status for the current operating week.", "meta"],
      ["Stock Control", "Highlights item condition, location, vendor and current value.", "note"],
      ["Review Owner", "Used by storekeepers, managers and owners before weekly buying decisions.", "party"],
    ],
    headers: ["Period", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "Item no.", "Name", "Description", "Type", "Remarks", "Department", "Space", "Condition", "Vendor", "Current quantity", "Current value"],
    signatures: ["Prepared by", "Stock controller", "Manager review"],
    footerNote: "Use the weekly inventory report to check stock, review exceptions and prepare weekly purchase or transfer actions.",
    emphasis: "report",
  },
  "Monthly Inventory Report": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Month-end stock summary",
    table: "Monthly item balances and value",
    intro: [
      ["Month Scope", "Summarizes inventory position for the current month.", "meta"],
      ["Valuation", "Uses saved stock balances and current cost values.", "note"],
      ["Management Use", "Supports month-end review, reorder planning and stock valuation checks.", "party"],
    ],
    headers: ["Period", "Week 1", "Week 2", "Week 3", "Week 4", "Month total", "Item no.", "Name", "Description", "Type", "Remarks", "Department", "Space", "Condition", "Vendor", "Current quantity", "Current value", "Status"],
    signatures: ["Prepared by", "Accountant / stock controller", "Owner approval"],
    footerNote: "Use this month-end report to reconcile stock quantities, reorder status and inventory value before management accounts.",
    emphasis: "report",
  },
  "Annual Inventory Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Annual inventory movement and value view",
    table: "Yearly item availability and value by month",
    intro: [
      ["Year Scope", "Provides a year-oriented inventory review for annual planning.", "meta"],
      ["Business Control", "Shows current item status against monthly planning columns.", "note"],
      ["Audit Use", "Useful for annual review, valuation support and insurance schedules.", "party"],
    ],
    headers: ["Period", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "Item no.", "Name", "Description", "Type", "Remarks", "Department", "Vendor", "Current quantity", "Current value"],
    signatures: ["Prepared by", "Accountant", "Owner / auditor review"],
    footerNote: "Use the annual report as a year-end inventory control pack, then reconcile it with stock counts and financial statements.",
    emphasis: "report",
  },
  "Inventory Damage Report": {
    accent: "#DC2626",
    soft: "#FEF2F2",
    label: "Damaged stock and loss control register",
    table: "Damage condition, quantity, value and vendor context",
    intro: [
      ["Damage Control", "Records damaged, spoiled or unusable stock by item.", "meta"],
      ["Loss Exposure", "Shows asset value and total value exposure for owner review.", "note"],
      ["Approval", "Damage write-offs must be reviewed before financial posting.", "party"],
    ],
    headers: ["Item no.", "Name", "Description", "Type", "Department", "Space", "Date of last order", "Vendor", "Purchase price per item", "Warranty expiry date", "Condition", "Damage report", "Quantity", "Asset value", "Total value", "Model", "Vendor no."],
    signatures: ["Reported by", "Verified by", "Approved write-off by"],
    footerNote: "Damage reports should support write-offs, supplier claims, insurance claims and stock accountability.",
    emphasis: "control",
  },
  "Product Inventory Usage Report": {
    accent: "#7C3AED",
    soft: "#F5F3FF",
    label: "Usage and reorder planning report",
    table: "Reorder status, stock check, supplier and order quantities",
    intro: [
      ["Usage Control", "Shows which products are above or below reorder levels.", "meta"],
      ["Buying Guide", "Calculates reorder quantity and estimated order value from product setup.", "note"],
      ["Operations Use", "Used daily by storekeepers and buyers before placing orders.", "party"],
    ],
    headers: ["Reorder required (auto-fill)", "Item on reorder?", "Item no.", "Date of stock check", "Item name", "Vendor", "Vendor SKU", "Qty in stock", "Reorder level", "Qty above / below par", "Days per reorder", "Date of last order", "Date received / restocked", "Ordered by", "Unit cost", "Order qty", "Total order"],
    signatures: ["Prepared by", "Buyer review", "Owner / manager approval"],
    footerNote: "Use this report as the buying worksheet for reorder actions and stock availability decisions.",
    emphasis: "report",
  },
  "Inventory Sales Report": {
    accent: "#059669",
    soft: "#ECFDF5",
    label: "Inventory sales and margin trend",
    table: "Revenue, units sold, average order value and growth",
    intro: [
      ["Sales Period", "Groups posted sales allocations by month.", "meta"],
      ["Profit View", "Shows gross profit from posted source-cost allocations.", "note"],
      ["Owner Review", "Supports pricing, stock mix and reorder decisions.", "party"],
    ],
    headers: ["Month / year", "Revenue (KES)", "Units sold (#)", "Avg order value (KES)", "Revenue growth (%)", "Units sold growth (%)", "AOV growth (%)", "Gross profit"],
    signatures: ["Prepared by", "Sales manager", "Owner review"],
    footerNote: "Inventory sales reports should be reviewed together with stock source costs to protect margins.",
    emphasis: "report",
  },
  "Inventory Discrepancy Report": {
    accent: "#EA580C",
    soft: "#FFF7ED",
    label: "Physical count variance worksheet",
    table: "System stock, physical count and discrepancy action",
    intro: [
      ["Count Control", "Compares saved stock balances against entered physical counts.", "meta"],
      ["Exception Review", "Flags items awaiting count or needing adjustment.", "note"],
      ["Approval", "Inventory discrepancies require manager or owner approval before adjustment.", "party"],
    ],
    headers: ["Reorder (auto-fill)", "Discrepancy (auto-fill)", "Item no.", "Date of last order", "Item name", "Vendor", "Stock location", "Description", "On-hand quantity", "Actual item count", "Inventory discrepancy (auto-fill)", "Reorder level", "Days per reorder", "Item reorder quantity", "Item discontinued?"],
    signatures: ["Counted by", "Verified by", "Adjustment approved by"],
    footerNote: "Use discrepancy reports after stock counts to document differences and approve stock adjustments.",
    emphasis: "control",
  },
  "Inventory Aging Report": {
    accent: "#B45309",
    soft: "#FFF7ED",
    label: "Stock age and slow movement risk",
    table: "Last receipt, age bucket, inventory value and action",
    intro: [
      ["Age Review", "Uses latest receipt date where available to show aging risk.", "meta"],
      ["Risk Control", "Highlights slow-moving or old stock for pricing and reorder decisions.", "note"],
      ["Owner Action", "Useful for promotions, supplier negotiations and buying discipline.", "party"],
    ],
    headers: ["Item no.", "Item name", "Brand", "Category", "Stock location", "Last received", "Age days", "Age bucket", "Qty in stock", "Unit cost", "Inventory value", "Risk level", "Recommended action"],
    signatures: ["Prepared by", "Stock manager", "Owner review"],
    footerNote: "Aging reports help identify old, slow-moving or dead stock before it ties up too much cash.",
    emphasis: "report",
  },
  "Inventory Audit Report": {
    accent: "#334155",
    soft: "#F8FAFC",
    label: "Inventory audit extract",
    table: "Setup, costing, stock, reorder and tax audit fields",
    intro: [
      ["Audit Scope", "Provides a complete inventory control extract for audit review.", "meta"],
      ["Completeness", "Includes product setup, cost, stock balance, reorder and tax treatment.", "note"],
      ["Audit Use", "Useful for internal control checks, accountant review and owner sign-off.", "party"],
    ],
    headers: ["Reorder (auto-fill)", "Item no.", "Date of last order", "Item name", "Vendor", "Stock location", "Description", "Cost per item", "Stock quantity", "Total value", "Reorder level", "Days per reorder", "Item reorder quantity", "Item discontinued?", "VAT treatment", "Tracking"],
    signatures: ["Prepared by", "Accountant / controller", "Owner / auditor sign-off"],
    footerNote: "Use the audit report to verify product setup, stock value, reorder controls and tax treatment.",
    emphasis: "report",
  },
  "Quotation": {
    accent: "#7C3AED",
    soft: "#F5F3FF",
    label: "Commercial offer before sale",
    table: "Quoted goods, validity and commercial terms",
    intro: [
      ["Quote To", "Customer, contact person, delivery town and PIN where available.", "party"],
      ["Validity", "Quote date, valid-until date, currency and price-hold terms.", "meta"],
      ["Acceptance", "Customer signature, approved discount and conversion to sales order.", "note"],
    ],
    headers: ["#", "Item & Description", "Qty", "Unit", "Quoted Rate", "Discount", "VAT", "Line Total"],
    signatures: ["Prepared by", "Accepted by customer", "Approved by"],
    footerNote: "This quotation is not a tax invoice and is valid only within the stated period.",
    emphasis: "invoice",
  },
  "Proforma Invoice": {
    accent: "#B45309",
    soft: "#FFF7ED",
    label: "Prepayment and supply request",
    table: "Proforma items and advance amount requested",
    intro: [
      ["Bill To", "Customer details and intended place of supply.", "party"],
      ["Proforma Terms", "Reference, proforma date, expiry date and payment instructions.", "meta"],
      ["Conversion", "Convert to tax invoice only after acceptance or payment.", "note"],
    ],
    headers: ["#", "Item & Description", "Qty", "Rate", "Tax Basis", "Advance Due", "Amount"],
    signatures: ["Prepared by", "Customer acceptance", "Finance review"],
    footerNote: "A proforma invoice is a request for payment and not a tax document until converted.",
    emphasis: "invoice",
  },
  Invoice: {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Customer invoice",
    table: "Invoice line items and amount due",
    intro: [
      ["Bill To", "Customer name, address, PIN and account terms where available.", "party"],
      ["Invoice Details", "Invoice number, invoice date, due date and payment terms.", "meta"],
      ["Amount Due", "Shows what the customer should pay and the current outstanding balance.", "note"],
    ],
    headers: ["Code", "Description", "Qty", "Inclusive Unit Price", "Amount", "Amount Paid", "Balance Due"],
    signatures: ["Prepared by", "Customer / recipient", "Owner"],
    footerNote: "This invoice states the amount due from the customer. Selling prices are VAT-inclusive where VAT applies, so VAT is not added again on top.",
    emphasis: "invoice",
  },
  "Tax Invoice": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Taxable sale document",
    table: "Taxable supply line items",
    intro: [
      ["Bill To", "Customer name, address, PIN and account terms.", "party"],
      ["Tax Details", "Invoice number, invoice date, due date and eTIMS reference where applicable.", "meta"],
      ["Supply Details", "Branch, route, delivery note and place of supply.", "note"],
    ],
    headers: ["Code", "Description", "Qty", "Unit Price", "Discount", "VAT Rate", "VAT Amount", "Amount"],
    signatures: ["Prepared by", "Checked by", "Customer / recipient"],
    footerNote: "Tax invoice values should reconcile to sales ledger, VAT output and customer balance.",
    emphasis: "invoice",
  },
  "Simplified Invoice": {
    accent: "#2563EB",
    soft: "#EFF6FF",
    label: "Fast counter-sale invoice",
    table: "Simplified sale details",
    intro: [
      ["Sold To", "Walk-in or customer account details.", "party"],
      ["Counter Sale", "Invoice date, receipt status, cashier and payment method.", "meta"],
      ["Tax Summary", "Gross, VAT and net value for daily reconciliation.", "note"],
    ],
    headers: ["Item", "Qty", "Unit Price", "VAT", "Line Total"],
    signatures: ["Cashier", "Customer", "Supervisor"],
    footerNote: "Designed for quick sales while keeping taxable value and payment evidence clear.",
    emphasis: "invoice",
  },
  "Credit Note": {
    accent: "#BE123C",
    soft: "#FFF1F2",
    label: "Customer credit adjustment",
    table: "Credited items and approved reason",
    intro: [
      ["Credit To", "Customer credited and original invoice reference.", "party"],
      ["Credit Details", "Credit note number, date, tax treatment and approval state.", "meta"],
      ["Reason", "Return, price correction, damaged goods or approved commercial adjustment.", "note"],
    ],
    headers: ["Original Ref", "Description", "Qty", "Unit Price", "Tax Credit", "Credit Amount", "Reason"],
    signatures: ["Prepared by", "Approved by", "Customer acknowledged"],
    footerNote: "Credit notes must link to the original invoice and remain auditable.",
    emphasis: "control",
  },
  "Debit Note": {
    accent: "#9333EA",
    soft: "#FAF5FF",
    label: "Additional amount due",
    table: "Debited items and basis",
    intro: [
      ["Debit To", "Customer or supplier being debited.", "party"],
      ["Debit Details", "Debit note number, date, source reference and due date.", "meta"],
      ["Basis", "Short billing, additional charge, tax correction or stock adjustment.", "note"],
    ],
    headers: ["Source Ref", "Description", "Qty", "Unit Price", "Tax", "Debit Amount", "Reason"],
    signatures: ["Prepared by", "Reviewed by", "Approved by"],
    footerNote: "Debit notes must state the commercial reason and linked source document.",
    emphasis: "control",
  },
  "Basic Daily Sales Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Daily itemized sales register",
    table: "Items sold, quantity, tax and total",
    intro: [
      ["Sales Day", "Summarizes posted invoices and item lines for the selected day.", "meta"],
      ["Cash Desk", "Shows sales amount, tax and total for daily reconciliation.", "note"],
      ["Prepared For", "Used by sales staff, cashier, manager and accountant.", "party"],
    ],
    headers: ["Item no", "Item name", "Item description", "Price", "Qty", "Amount", "Tax rate", "Tax", "Total", "Invoice no.", "Date", "Customer"],
    signatures: ["Prepared by", "Cashier / salesperson", "Manager review"],
    footerNote: "Use the daily sales report to reconcile invoices, item quantities, VAT and collections before closing the day.",
    emphasis: "report",
  },
  "Daily Sales KPI Report": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Daily sales KPI and growth report",
    table: "Revenue, customers, AOV and growth by day",
    intro: [
      ["KPI Cycle", "Tracks day-by-day posted sales performance.", "meta"],
      ["Growth View", "Compares revenue and customer movement against the previous reported day.", "note"],
      ["Owner Use", "A fast owner view of daily trading health.", "party"],
    ],
    headers: ["Day", "Revenue (KES)", "Customers (#)", "Average order value (KES)", "Revenue growth (%)", "Customer growth (%)", "AOV growth (%)", "Sales tax", "Balance due"],
    signatures: ["Prepared by", "Sales manager", "Owner review"],
    footerNote: "Use this report as the daily KPI pulse: revenue, customer activity, AOV, VAT and unpaid balances.",
    emphasis: "report",
  },
  "Hourly Sales Report": {
    accent: "#0891B2",
    soft: "#ECFEFF",
    label: "Hourly trading pattern report",
    table: "Transaction count, item count, average sale and hourly revenue",
    intro: [
      ["Trading Hours", "Groups posted sales by creation hour.", "meta"],
      ["Staffing Insight", "Helps identify busy and quiet sales windows.", "note"],
      ["Operations Use", "Useful for cash desk planning, route timing and staff coverage.", "party"],
    ],
    headers: ["Period", "Transaction count", "Customers (#)", "Average order value (KES)", "Revenue (KES)", "Sales tax", "Balance due", "Notes"],
    signatures: ["Prepared by", "Cash desk", "Manager review"],
    footerNote: "Use hourly sales reports to understand demand by time of day and reduce missed sales during peak windows.",
    emphasis: "report",
  },
  "Sales Rep Daily Report": {
    accent: "#7C3AED",
    soft: "#F5F3FF",
    label: "Salesperson daily item report",
    table: "Items sold, customer, tax and total by representative",
    intro: [
      ["Salesperson", "Shows daily item movement from posted invoices.", "meta"],
      ["Performance", "Useful for salesperson accountability and commission review.", "note"],
      ["Manager Use", "Review item lines, customers and totals before approval.", "party"],
    ],
    headers: ["Invoice no.", "Date", "Customer", "Item no", "Item name", "Price", "Qty", "Amount", "Tax", "Total"],
    signatures: ["Salesperson", "Cashier", "Manager approval"],
    footerNote: "Use this daily report to review representative activity, customer coverage and item-level selling.",
    emphasis: "report",
  },
  "Weekly Sales Activity Report": {
    accent: "#2563EB",
    soft: "#EFF6FF",
    label: "Weekly sales activity and target report",
    table: "Daily activity, deals closed, products sold, revenue, target and variance",
    intro: [
      ["Report Week", "Summarizes daily sales activity for the week.", "meta"],
      ["Target Review", "Shows revenue against target and follow-up requirements.", "note"],
      ["Sales Management", "Useful for owner, manager and field sales reviews.", "party"],
    ],
    headers: ["Day", "Cold calls made", "Follow-up calls", "Emails sent", "Meetings arranged", "Visits completed", "Leads generated", "Deals closed", "Products sold", "Sales revenue", "Target amount", "Variance", "Notes"],
    signatures: ["Prepared by", "Sales representative", "Sales manager"],
    footerNote: "Use this report to connect sales activity with actual posted revenue and collection follow-up.",
    emphasis: "report",
  },
  "Weekly Sales Call Report": {
    accent: "#0E7490",
    soft: "#ECFEFF",
    label: "Weekly customer contact and follow-up report",
    table: "Daily customer activity, closed deals and follow-up notes",
    intro: [
      ["Contact Week", "Summarizes sales contact and follow-up activity.", "meta"],
      ["Customer Follow-up", "Highlights unpaid balances and customer action points.", "note"],
      ["Sales Discipline", "Useful for route teams and office follow-ups.", "party"],
    ],
    headers: ["Day", "Transaction count", "Customers (#)", "Revenue", "Balance due", "Notes"],
    signatures: ["Prepared by", "Sales representative", "Manager review"],
    footerNote: "Use weekly call reports to plan customer follow-ups, collections and repeat orders.",
    emphasis: "report",
  },
  "Weekly Route Sales Report": {
    accent: "#0E7490",
    soft: "#ECFEFF",
    label: "Weekly route sales report",
    table: "Daily route revenue, invoices and balances",
    intro: [
      ["Route Week", "Shows week-level sales performance for route or field activity.", "meta"],
      ["Collections", "Flags balances that need follow-up.", "note"],
      ["Operations Use", "Helpful for route reconciliation and manager review.", "party"],
    ],
    headers: ["Day", "Transaction count", "Customers (#)", "Revenue", "Balance due", "Notes"],
    signatures: ["Prepared by", "Route salesperson", "Manager review"],
    footerNote: "Use weekly route sales reports to reconcile field sales and plan the next route cycle.",
    emphasis: "report",
  },
  "Sales Tracking Report": {
    accent: "#059669",
    soft: "#ECFDF5",
    label: "Product revenue, markup and profit tracking",
    table: "Product revenue, cost, markup, returns and income",
    intro: [
      ["Product Revenue", "Tracks sales performance by sold product.", "meta"],
      ["Margin Control", "Uses standard cost and FIFO/source allocations where available.", "note"],
      ["Owner Insight", "Shows which products are protecting or leaking profit.", "party"],
    ],
    headers: ["Product name", "Cost per item", "Markup percentage", "Total sold", "Total revenue", "Shipping charge per item", "Shipping cost per item", "Profit per item", "Returns", "Total income"],
    signatures: ["Prepared by", "Sales manager", "Owner review"],
    footerNote: "Use sales tracking to decide pricing, reorder priorities and product focus.",
    emphasis: "report",
  },
  "Deal Loss Reasons Report": {
    accent: "#DC2626",
    soft: "#FEF2F2",
    label: "Lost opportunity reasons and value",
    table: "Loss reasons, lost count, lost value and next action",
    intro: [
      ["Loss Window", "Tracks rejected quotations, cancelled orders and missed opportunities when recorded.", "meta"],
      ["Recovery", "Shows where sales are being lost and what to fix.", "note"],
      ["Management Use", "Useful for pricing, credit, stock availability and competitor review.", "party"],
    ],
    headers: ["Loss reasons", "Lost count", "Lost value", "Recommended action"],
    signatures: ["Prepared by", "Sales manager", "Owner review"],
    footerNote: "Start recording lost deals so this report can explain lost revenue by reason and value.",
    emphasis: "control",
  },
  "Monthly Retail Sales Summary Report": {
    accent: "#1455D9",
    soft: "#EEF6FF",
    label: "Monthly sales summary",
    table: "Total sales, orders, customers, VAT and balances",
    intro: [
      ["Reporting Period", "Summarizes posted sales for the month.", "meta"],
      ["Month-End Review", "Shows revenue, customers, average order value and collections.", "note"],
      ["Accountant Use", "Supports month-end sales, VAT and debtor checks.", "party"],
    ],
    headers: ["Period", "Revenue (KES)", "Customers (#)", "Transaction count", "Average order value (KES)", "Sales tax", "Amount paid", "Balance due", "Notes"],
    signatures: ["Prepared by", "Accountant", "Owner approval"],
    footerNote: "Use this report to close the month with sales totals, VAT, collections and customer activity in one place.",
    emphasis: "report",
  },
  "Monthly Sales Report Dashboard": {
    accent: "#334155",
    soft: "#F8FAFC",
    label: "Monthly sales dashboard pack",
    table: "Dashboard metrics for revenue, customer activity and conversion proxy",
    intro: [
      ["Dashboard Period", "Presents month-level sales performance in a board-ready format.", "meta"],
      ["Business View", "Shows revenue, orders, customers, AOV and outstanding balance.", "note"],
      ["Owner Pack", "Use as the monthly executive sales pack.", "party"],
    ],
    headers: ["Period", "Revenue (KES)", "Customers (#)", "Transaction count", "Average order value (KES)", "Revenue growth (%)", "Customer growth (%)", "Balance due", "Notes"],
    signatures: ["Prepared by", "Sales manager", "Owner review"],
    footerNote: "Use the monthly dashboard to review sales momentum, customer volume and cash collection risk.",
    emphasis: "report",
  },
  "Quarterly Sales Report": {
    accent: "#B45309",
    soft: "#FFF7ED",
    label: "Quarterly sales actuals and variance report",
    table: "Quarter revenue, customer count, quota and variance",
    intro: [
      ["Quarter", "Groups posted sales by quarter.", "meta"],
      ["Quota View", "Compares actual sales against configured targets when available.", "note"],
      ["Management Review", "Useful for quarterly pricing, growth and cash planning.", "party"],
    ],
    headers: ["Period", "Revenue (KES)", "Customers (#)", "Transaction count", "Average order value (KES)", "Target", "Variance", "Sales tax", "Balance due"],
    signatures: ["Prepared by", "Sales manager", "Owner / directors"],
    footerNote: "Use quarterly reports to review sales consistency, target gaps and collection risk across the year.",
    emphasis: "report",
  },
  "Annual Sales Performance Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Annual sales performance pack",
    table: "Quarterly revenue, customers, AOV and growth",
    intro: [
      ["Annual Review", "Groups posted sales into quarterly performance rows.", "meta"],
      ["Board View", "Shows sales progress, growth and customer activity for the year.", "note"],
      ["Strategic Use", "Useful for annual planning, bank packs and owner review.", "party"],
    ],
    headers: ["Period", "Revenue (KES)", "Customers (#)", "Transaction count", "Average order value (KES)", "Revenue growth (%)", "Customer growth (%)", "Sales tax", "Balance due"],
    signatures: ["Prepared by", "Accountant", "Owner / board review"],
    footerNote: "Use the annual report as the sales section of the year-end business pack.",
    emphasis: "report",
  },
  "Year-End Sales Report": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Year-end sales board report",
    table: "Quarterly sales performance, tax and collection position",
    intro: [
      ["Year End", "Summarizes posted sales for the financial year.", "meta"],
      ["Board Pack", "Supports directors, owners, accountants and bank presentations.", "note"],
      ["Next Year", "Use this to set product, route and customer priorities.", "party"],
    ],
    headers: ["Period", "Revenue (KES)", "Customers (#)", "Transaction count", "Average order value (KES)", "Revenue growth (%)", "Customer growth (%)", "Sales tax", "Balance due"],
    signatures: ["Prepared by", "Accountant", "Owner / board approval"],
    footerNote: "Use the year-end report to summarize revenue, customer growth, VAT and collection status.",
    emphasis: "report",
  },
  "Sales Receipt": {
    accent: "#0F766E",
    soft: "#ECFDF5",
    label: "Payment acknowledgement",
    table: "Received items and tender details",
    intro: [
      ["Received From", "Customer, payer name and account balance context.", "party"],
      ["Payment Details", "Receipt number, payment date, mode, reference and cashier.", "meta"],
      ["Allocation", "Invoice allocation, unallocated amount and balance due after payment.", "note"],
    ],
    headers: ["Code", "Particulars", "Qty", "Rate", "Tax", "Amount"],
    signatures: ["Cashier", "Customer", "Supervisor"],
    footerNote: "Thank you. Keep this receipt as payment evidence.",
    emphasis: "receipt",
  },
  "Delivery Note": {
    accent: "#0891B2",
    soft: "#ECFEFF",
    label: "Goods delivery confirmation",
    table: "Ordered, delivered and outstanding quantities",
    intro: [
      ["Deliver To", "Customer delivery address and receiving contact.", "party"],
      ["Delivery Details", "Delivery note number, order reference, route and dispatch date.", "meta"],
      ["Condition", "Customer confirms quantities and records exceptions before signing.", "note"],
    ],
    headers: ["Item #", "Description", "Ordered", "Delivered", "Outstanding", "Condition"],
    signatures: ["Delivered by", "Received by", "Checked by"],
    footerNote: "Customer signature confirms goods were received in the stated condition.",
    emphasis: "operations",
  },
  "Dispatch Note": {
    accent: "#0E7490",
    soft: "#ECFEFF",
    label: "Dispatch control document",
    table: "Dispatch load, route and vehicle details",
    intro: [
      ["Dispatch From", "Warehouse, route, vehicle and driver.", "meta"],
      ["Dispatch To", "Customer, route stop or receiving branch.", "party"],
      ["Control Checks", "Loading, seal, odometer, fuel and document pack confirmation.", "note"],
    ],
    headers: ["Route / Vehicle", "Item", "Loaded", "Delivered", "Returned", "Driver Notes"],
    signatures: ["Loaded by", "Driver", "Dispatch supervisor"],
    footerNote: "Dispatch notes support route accountability before proof of delivery is collected.",
    emphasis: "operations",
  },
  "Customer Statement": {
    accent: "#334155",
    soft: "#F8FAFC",
    label: "Customer account movement",
    table: "Statement ledger",
    intro: [
      ["Account Holder", "Customer account, credit terms and contact details.", "party"],
      ["Statement Period", "Opening balance, statement date range and currency.", "meta"],
      ["Ageing Note", "Overdue balances should be followed up using collection priorities.", "note"],
    ],
    headers: ["Date", "Document", "Description", "Debit", "Credit", "Running Balance"],
    signatures: ["Prepared by", "Accounts review", "Customer acknowledgement"],
    footerNote: "Please report statement differences within the agreed credit-control period.",
    emphasis: "ledger",
  },
  "Outstanding Balance Statement": {
    accent: "#475569",
    soft: "#F8FAFC",
    label: "Balance follow-up document",
    table: "Outstanding invoices and expected collections",
    intro: [
      ["Customer", "Debtor details, route and contact.", "party"],
      ["Collection Summary", "Overdue amount, oldest invoice and expected payment date.", "meta"],
      ["Follow Up", "Recommended collection action and responsible person.", "note"],
    ],
    headers: ["Invoice Date", "Invoice No.", "Due Date", "Age", "Original Amount", "Paid", "Outstanding"],
    signatures: ["Prepared by", "Credit controller", "Customer response"],
    footerNote: "Outstanding statements are for collection follow-up and customer reconciliation.",
    emphasis: "ledger",
  },
  "Sales Order": {
    accent: "#1D4ED8",
    soft: "#EFF6FF",
    label: "Approved customer demand",
    table: "Ordered goods and fulfilment status",
    intro: [
      ["Order For", "Customer account, branch and delivery instructions.", "party"],
      ["Order Details", "Sales order number, order date, delivery date and payment status.", "meta"],
      ["Fulfilment", "Stock reservation, picking status and dispatch readiness.", "note"],
    ],
    headers: ["SKU", "Description", "Ordered", "Reserved", "Packed", "Backorder", "Amount"],
    signatures: ["Created by", "Approved by", "Fulfilment check"],
    footerNote: "Sales orders become invoices or delivery tasks only after approval and stock checks.",
    emphasis: "operations",
  },
  "Sales Return Note": {
    accent: "#BE123C",
    soft: "#FFF1F2",
    label: "Customer return control",
    table: "Returned goods and credit decision",
    intro: [
      ["Returned By", "Customer, original invoice and delivery reference.", "party"],
      ["Return Details", "Return number, return date, reason and stock disposition.", "meta"],
      ["Inspection", "Accept, quarantine, write off or return to saleable stock.", "note"],
    ],
    headers: ["Original Ref", "Item", "Qty Returned", "Condition", "Disposition", "Credit Required", "Reason"],
    signatures: ["Received by", "Inspected by", "Approved by"],
    footerNote: "Return notes must be inspected before credit or stock movement is posted.",
    emphasis: "control",
  },
};

function blueprintFromTerms(report: Report): DocumentBlueprint {
  const name = report.processName;
  const value = `${report.moduleName} ${name}`.toLowerCase();
  const base: DocumentBlueprint = {
    accent: "#1455D9",
    soft: "#F8FBFF",
    label: "Business document",
    table: "Document detail",
    intro: [
      ["Prepared For", "Business party, branch, period and operating context.", "party"],
      ["Document Control", "Reference number, date, owner and status.", "meta"],
      ["Purpose", "Clear record for review, filing, audit and action.", "note"],
    ],
    headers: ["Reference", "Description", "Quantity", "Rate", "Tax", "Amount"],
    signatures: ["Prepared by", "Reviewed by", "Approved by"],
    footerNote: "Generated by Solva Trade using tenant-scoped records and export controls.",
    emphasis: "control",
  };

  if (value.includes("purchase requisition")) {
    return { ...base, accent: "#7C3AED", soft: "#F5F3FF", label: "Internal purchase request", table: "Requested items and approval need", headers: ["Req #", "Requested Item", "Branch", "Needed By", "Qty", "Reason", "Approval"], signatures: ["Requested by", "Department head", "Purchasing approval"], footerNote: "Purchase requisitions authorise need, not supplier commitment.", emphasis: "control" };
  }
  if (value.includes("request for quotation") || value.includes("rfq")) {
    return { ...base, accent: "#334155", soft: "#F8FAFC", label: "Supplier quote request", table: "Requested specifications and supplier response", headers: ["Line", "Specification", "Qty", "Required Date", "Supplier Price", "Lead Time", "Remarks"], signatures: ["Prepared by", "Supplier", "Procurement review"], footerNote: "RFQs collect supplier offers and do not create stock or payables.", emphasis: "invoice" };
  }
  if (value.includes("quotation comparison")) {
    return { ...base, accent: "#0F766E", soft: "#ECFDF5", label: "Supplier selection worksheet", table: "Supplier quote comparison", headers: ["Item", "Supplier A", "Supplier B", "Supplier C", "Best Price", "Lead Time", "Recommendation"], signatures: ["Prepared by", "Reviewed by", "Selection approved"], footerNote: "Comparison should preserve the reason for choosing a supplier.", emphasis: "report" };
  }
  if (value.includes("purchase source profitability") || value.includes("direct vs local") || value.includes("emergency purchase impact") || value.includes("supplier price comparison")) {
    return {
      ...base,
      accent: value.includes("emergency") ? "#D8A43B" : value.includes("direct vs local") ? "#1455D9" : "#071A2B",
      soft: value.includes("emergency") ? "#FFF8E6" : "#EEF6FF",
      label: "Source-aware purchasing intelligence",
      table: "Source, supplier, buying cost, benchmark variance and potential margin",
      headers: ["#", "Product", "Source", "Supplier", "Qty Received", "Unit Cost", "Direct Benchmark", "Cost Variance", "Potential Profit"],
      signatures: ["Prepared by", "Purchasing review", "Owner decision"],
      footerNote: "Source reports separate direct supplier, local market, spot, alternative and emergency purchases so owners can protect margin.",
      emphasis: "report",
    };
  }
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    return {
      ...base,
      accent: "#1455D9",
      soft: "#EEF6FF",
      label: "Customer account statement",
      table: "Invoices, receipts and running balance",
      headers: ["#", "Date", "Document No.", "Type", "Description", "Debit", "Credit", "Balance"],
      signatures: [],
      footerNote: "Please confirm this statement within the agreed credit-control period.",
      emphasis: "report",
    };
  }
  if (value.includes("profit by customer") || value.includes("customer profit")) {
    return {
      ...base,
      accent: "#1455D9",
      soft: "#EEF6FF",
      label: "Customer profitability",
      table: "Customer revenue, FIFO cost, gross profit and margin",
      headers: ["#", "Customer", "Invoices", "Units sold", "Revenue", "FIFO cost", "Gross profit", "Margin"],
      signatures: ["Prepared by", "Owner review", "Pricing action"],
      footerNote: "Profit by customer helps owners identify the customers creating the best margin after stock cost.",
      emphasis: "report",
    };
  }
  if (value.includes("profit by supplier") || value.includes("supplier source profit")) {
    return {
      ...base,
      accent: "#047857",
      soft: "#ECFDF5",
      label: "Supplier/source profitability",
      table: "Source supplier, stock source, revenue, FIFO cost, gross profit and margin",
      headers: ["#", "Source", "Supplier", "Products", "Units sold", "Revenue", "FIFO cost", "Gross profit", "Margin"],
      signatures: ["Prepared by", "Owner review", "Buying decision"],
      footerNote: "Supplier/source profit shows which purchase channels and suppliers produce the strongest sales margin.",
      emphasis: "report",
    };
  }
  if (value.includes("sale source profitability") || value.includes("source profit by sale") || value.includes("fifo profit") || value.includes("profit by purchase source") || value.includes("direct supplier stock profit") || value.includes("local market stock profit")) {
    return {
      ...base,
      accent: value.includes("local market") ? "#B45309" : value.includes("direct") ? "#047857" : "#071A2B",
      soft: value.includes("local market") ? "#FFF7ED" : "#ECFDF5",
      label: "FIFO source-cost sales profitability",
      table: "Sale, product, source supplier, FIFO cost, sale value and gross profit",
      headers: ["#", "Invoice / Product", "Source", "Supplier", "Qty Sold", "FIFO Unit Cost", "Sale Price", "Cost Value", "Gross Profit", "Margin"],
      signatures: ["Prepared by", "Margin reviewed by", "Owner decision"],
      footerNote: "This report allocates each sale to the actual stock cost layer consumed so direct-supplier and local-market margins can be compared.",
      emphasis: "report",
    };
  }
  if (value.includes("purchase order")) {
    return { ...base, accent: "#1D4ED8", soft: "#EFF6FF", label: "Supplier buying instruction", table: "Ordered items and commercial terms", headers: ["S/No", "Product Code", "Product Name", "Qty", "Unit", "Rate", "Tax", "Amount"], signatures: ["Requisitioner", "Authorised signatory", "Supplier acknowledgement"], footerNote: "Quote the purchase order number on all delivery notes and invoices.", emphasis: "invoice" };
  }
  if (value.includes("goods received") || value.includes("grn")) {
    return { ...base, accent: "#15803D", soft: "#F0FDF4", label: "Receiving and inspection note", table: "Goods received inspection", headers: ["S/No", "Description", "Item Code", "Units", "Qty Ordered", "Qty Received", "Qty Returned", "Condition"], signatures: ["Prepared by", "Quality checked by", "Received into stock by"], footerNote: "GRNs update stock only after received quantities and exceptions are confirmed.", emphasis: "operations" };
  }
  if (value.includes("supplier delivery note")) {
    return { ...base, accent: "#0891B2", soft: "#ECFEFF", label: "Supplier delivery evidence", table: "Supplier-delivered goods", headers: ["Supplier Ref", "Item", "Delivered Qty", "Accepted Qty", "Rejected Qty", "Batch", "Condition"], signatures: ["Supplier driver", "Receiving clerk", "Store supervisor"], footerNote: "Supplier delivery notes are matched to GRNs and purchase orders.", emphasis: "operations" };
  }
  if (value.includes("supplier invoice register")) {
    return { ...base, accent: "#0F172A", soft: "#F8FAFC", label: "Supplier billing register", table: "Supplier invoice matching register", headers: ["Invoice Date", "Supplier Invoice", "PO", "GRN", "Tax", "Gross", "Match Status", "Exception"], signatures: ["Captured by", "Matched by", "Accounts approval"], footerNote: "Supplier invoices should be matched before creditor balances are posted.", emphasis: "ledger" };
  }
  if (value.includes("supplier statement") || value.includes("supplier aging") || value.includes("supplier ageing") || value.includes("supplier payment history")) {
    return { ...base, accent: "#475569", soft: "#F8FAFC", label: "Supplier account reconciliation", table: "Supplier account ledger", headers: ["Date", "Document", "Description", "Debit", "Credit", "Running Balance", "Age"], signatures: ["Prepared by", "Supplier review", "Accounts approval"], footerNote: "Supplier balances reconcile bills, payments, debit notes and opening balances.", emphasis: "ledger" };
  }
  if (value.includes("purchase return")) {
    return { ...base, accent: "#BE123C", soft: "#FFF1F2", label: "Supplier return note", table: "Returned goods and supplier credit tracking", headers: ["Source GRN", "Item", "Qty Returned", "Condition", "Reason", "Credit Expected", "Status"], signatures: ["Prepared by", "Supplier received", "Credit approved"], footerNote: "Purchase returns must link to supplier credit or replacement action.", emphasis: "control" };
  }
  if (value.includes("stock card")) {
    return { ...base, accent: "#0369A1", soft: "#F0F9FF", label: "Product movement ledger", table: "Stock card by product", headers: ["Date", "Reference", "Movement Type", "In", "Out", "Balance", "Unit Cost", "Value"], signatures: ["Prepared by", "Stores review", "Inventory control"], footerNote: "Stock cards show product-level quantity and value movement history.", emphasis: "ledger" };
  }
  if (value.includes("bin card")) {
    return { ...base, accent: "#0E7490", soft: "#ECFEFF", label: "Shelf/bin quantity card", table: "Bin-level movement control", headers: ["Date", "Reference", "Received", "Issued", "Balance", "Bin", "Checked By"], signatures: ["Storekeeper", "Checked by", "Supervisor"], footerNote: "Bin cards support physical stock checks at storage-location level.", emphasis: "operations" };
  }
  if (value.includes("stock movement")) {
    return { ...base, accent: "#0369A1", soft: "#F0F9FF", label: "Inventory movement report", table: "Stock movement trace", headers: ["Date", "SKU", "Description", "In", "Out", "Balance", "Warehouse", "Batch"], signatures: ["Prepared by", "Reviewed by", "Inventory manager"], footerNote: "Stock movement reports trace every stock-in and stock-out event.", emphasis: "ledger" };
  }
  if (value.includes("adjustment")) {
    return { ...base, accent: "#B45309", soft: "#FFF7ED", label: "Stock/ledger adjustment control", table: "Adjustment detail and approval trail", headers: ["Reference", "Item / Account", "Before", "Adjustment", "After", "Value Effect", "Reason"], signatures: ["Prepared by", "Investigated by", "Approved by"], footerNote: "Adjustments require reasons and approval because they alter balances.", emphasis: "control" };
  }
  if (value.includes("transfer")) {
    return { ...base, accent: "#1D4ED8", soft: "#EFF6FF", label: "Transfer control note", table: "Transfer quantities and receiving confirmation", headers: ["Item", "From", "To", "Sent Qty", "Received Qty", "Variance", "Status"], signatures: ["Released by", "Transported by", "Received by"], footerNote: "Transfers remain open until the receiving location confirms quantities.", emphasis: "operations" };
  }
  if (value.includes("count sheet")) {
    return { ...base, accent: "#334155", soft: "#F8FAFC", label: "Physical count worksheet", table: "Blind count entries", headers: ["SKU", "Description", "Bin", "System Qty", "Counted Qty", "Variance", "Counter"], signatures: ["Counted by", "Recounted by", "Approved by"], footerNote: "Physical count sheets support recounts and variance approval.", emphasis: "control" };
  }
  if (value.includes("damaged") || value.includes("expired")) {
    return { ...base, accent: "#BE123C", soft: "#FFF1F2", label: "Exception stock report", table: "Damaged or expired stock detail", headers: ["SKU", "Description", "Batch", "Expiry", "Qty", "Value", "Action"], signatures: ["Reported by", "Inspected by", "Approved disposal"], footerNote: "Exception stock reports support quarantine, write-off and supplier-claim decisions.", emphasis: "control" };
  }
  if (value.includes("slow-moving") || value.includes("fast-moving") || value.includes("reorder") || value.includes("valuation") || value.includes("inventory opportunity")) {
    return { ...base, accent: "#475569", soft: "#F8FAFC", label: "Inventory intelligence report", table: "Inventory performance and action list", headers: ["SKU", "Description", "On Hand", "Sales Velocity", "Value", "Risk", "Recommended Action"], signatures: ["Prepared by", "Inventory review", "Owner action"], footerNote: "Inventory intelligence reports guide reorder, pricing and clearance decisions.", emphasis: "report" };
  }
  if (value.includes("delivery manifest")) {
    return { ...base, accent: "#0891B2", soft: "#ECFEFF", label: "Route delivery manifest", table: "Stops, invoices and delivery load", headers: ["Stop", "Customer", "Invoice", "Area", "Packages", "COD Due", "Delivery Status"], signatures: ["Dispatcher", "Driver", "Route supervisor"], footerNote: "Delivery manifests guide route execution and customer-stop accountability.", emphasis: "operations" };
  }
  if (value.includes("loading sheet")) {
    return { ...base, accent: "#0E7490", soft: "#ECFEFF", label: "Vehicle loading control", table: "Vehicle load checklist", headers: ["SKU", "Description", "Batch", "Ordered", "Picked", "Loaded", "Variance"], signatures: ["Picker", "Loader", "Driver"], footerNote: "Loading sheets confirm stock moved from warehouse to vehicle.", emphasis: "operations" };
  }
  if (value.includes("route sheet")) {
    return { ...base, accent: "#0369A1", soft: "#F0F9FF", label: "Driver route plan", table: "Route stops and instructions", headers: ["Stop", "Customer", "Location", "Contact", "Delivery Window", "Amount Due", "Instructions"], signatures: ["Planner", "Driver", "Supervisor"], footerNote: "Route sheets help drivers execute stops in the correct order.", emphasis: "operations" };
  }
  if (value.includes("proof of delivery") || value.includes("pod") || value.includes("delivery confirmation")) {
    return { ...base, accent: "#0F766E", soft: "#ECFDF5", label: "Customer receipt of goods", table: "Proof and exception record", headers: ["Document", "Customer", "Delivered Qty", "Rejected Qty", "Condition", "Recipient", "Time"], signatures: ["Delivered by", "Received by", "Witness / stamp"], footerNote: "Proof of delivery confirms receipt and records disputes at the point of delivery.", emphasis: "operations" };
  }
  if (value.includes("driver") || value.includes("vehicle") || value.includes("route performance") || value.includes("fuel") || value.includes("maintenance") || value.includes("inspection") || value.includes("incident") || value.includes("operations")) {
    return { ...base, accent: "#0F172A", soft: "#F8FAFC", label: "Field operations control", table: "Operations activity and accountability", headers: ["Date", "Route / Vehicle", "Driver", "Activity", "Quantity / Amount", "Exception", "Action"], signatures: ["Prepared by", "Driver", "Operations manager"], footerNote: "Operations documents preserve driver, vehicle and route accountability.", emphasis: "operations" };
  }
  if (value.includes("cashbook")) {
    return { ...base, accent: "#047857", soft: "#ECFDF5", label: "Cash, bank and M-Pesa ledger", table: "Cashbook entries", headers: ["Date", "Reference", "Account", "Money In", "Money Out", "Tax", "Balance"], signatures: ["Prepared by", "Checked by", "Owner approval"], footerNote: "Cashbook reports reconcile receipts, payments and account balances.", emphasis: "ledger" };
  }
  if (value.includes("voucher")) {
    return { ...base, accent: "#92400E", soft: "#FFFBEB", label: "Payment or journal authorization", table: "Voucher allocation and approval", headers: ["Voucher No.", "Account", "Payee / Source", "Mode", "Reference", "Amount", "Approval"], signatures: ["Prepared by", "Authorised by", "Paid / posted by"], footerNote: "Vouchers document who authorised, paid and posted the transaction.", emphasis: "control" };
  }
  if (value.includes("bank deposit")) {
    return { ...base, accent: "#047857", soft: "#ECFDF5", label: "Banking slip record", table: "Deposit breakdown", headers: ["Date", "Account", "Cash", "Cheques", "M-Pesa", "Bank Ref", "Amount"], signatures: ["Prepared by", "Banked by", "Verified by"], footerNote: "Bank deposit slips support cash-to-bank reconciliation.", emphasis: "control" };
  }
  if (value.includes("reconciliation")) {
    return { ...base, accent: "#334155", soft: "#F8FAFC", label: "Reconciliation worksheet", table: "Matched and unmatched differences", headers: ["Date", "Reference", "Book Amount", "Statement Amount", "Difference", "Status", "Action"], signatures: ["Prepared by", "Reviewed by", "Approved by"], footerNote: "Reconciliation reports explain every difference before balances are accepted.", emphasis: "ledger" };
  }
  if (value.includes("profit and loss") || value.includes("income statement")) {
    return { ...base, accent: "#071A2B", soft: "#F8FAFC", label: "Profit and loss account", table: "Revenue, cost of sales, expenses and net result", headers: ["Section", "Account Code", "Account Name", "Debit", "Credit", "Amount", "Statement line"], signatures: ["Prepared by", "Accountant", "Owner / Director"], footerNote: "Profit and loss reports show income less direct costs and operating expenses from posted ledger activity.", emphasis: "ledger" };
  }
  if (value.includes("trial balance")) {
    return { ...base, accent: "#1455D9", soft: "#EEF6FF", label: "Trial balance", table: "Debit and credit account balances", headers: ["Account Code", "Account Name", "Class", "Debit", "Credit", "Closing Debit", "Closing Credit"], signatures: ["Prepared by", "Accountant", "Owner / Director"], footerNote: "Trial balance reports should balance total debits and credits before statements are finalized.", emphasis: "ledger" };
  }
  if (value.includes("balance sheet")) {
    return { ...base, accent: "#0F766E", soft: "#ECFDF5", label: "Statement of financial position", table: "Assets, liabilities, equity and balance check", headers: ["Section", "Account Code", "Account Name", "Debit", "Credit", "Closing", "Classification"], signatures: ["Prepared by", "Accountant", "Owner / Director"], footerNote: "Balance sheets present assets, liabilities and equity from posted ledger balances.", emphasis: "ledger" };
  }
  if (value.includes("cash flow") || value.includes("income statement") || value.includes("profit") || value.includes("balance sheet") || value.includes("trial balance") || value.includes("ledger") || value.includes("budget") || value.includes("expense analysis")) {
    return { ...base, accent: "#071A2B", soft: "#F8FAFC", label: "Financial statement", table: "Financial statement lines", headers: ["Account Code", "Account Name", "Opening", "Debit", "Credit", "Closing", "Variance"], signatures: ["Prepared by", "Accountant", "Owner / Director"], footerNote: "Financial statements should reconcile to posted ledger entries and approved periods.", emphasis: "ledger" };
  }
  if (value.includes("kra etr sales") || value.includes("etr sales report") || value.includes("cui invoice")) {
    return {
      ...base,
      accent: "#1455D9",
      soft: "#EEF6FF",
      label: "KRA ETR monthly sales register",
      table: "ETR sales from the 1st to 19th for VAT return preparation",
      intro: [
        ["VAT Period", "Sales dated from the 1st to the 19th, ready for review before the 20th filing deadline.", "meta"],
        ["Taxpayer", "Tenant KRA PIN, customer PINs and configured ETR/eTIMS device reference.", "party"],
        ["Control Note", "Use this report to reconcile ETR sales before filing VAT. It does not submit to KRA automatically.", "note"],
      ],
      headers: ["Sr. No", "Customer KRA PIN", "Customer Name", "KRA Device No.", "Invoice Date", "CUI Invoice No.", "Item Description", "Exclusive Amount", "VAT", "Inclusive Amount"],
      signatures: ["Prepared by", "Tax review", "Owner approval"],
      footerNote: "This KRA ETR sales report supports monthly VAT preparation for sales dated 1st to 19th. Confirm CUI and device details before filing on the 20th.",
      emphasis: "control",
    };
  }
  if (value.includes("vat") || value.includes("withholding") || value.includes("tax")) {
    return { ...base, accent: "#1455D9", soft: "#EEF6FF", label: "Tax compliance schedule", table: "Taxable values and filing evidence", headers: ["Tax Period", "Document", "PIN", "Taxable Value", "Tax Rate", "Tax Amount", "Filing Status"], signatures: ["Prepared by", "Tax review", "Authorised by"], footerNote: "Tax reports support statutory review and should be reconciled before submission.", emphasis: "control" };
  }
  if (value.includes("customer profile") || value.includes("supplier profile")) {
    return { ...base, accent: "#1D4ED8", soft: "#EFF6FF", label: "Master-data profile", table: "Profile, contacts and account settings", headers: ["Field", "Value", "Status", "Verified By", "Updated On", "Risk", "Notes"], signatures: ["Prepared by", "Verified by", "Approved by"], footerNote: "Profiles preserve master-data, contacts, tax details and payment terms.", emphasis: "control" };
  }
  if (value.includes("customer") || value.includes("top customers")) {
    return { ...base, accent: "#0F766E", soft: "#ECFDF5", label: "Customer intelligence", table: "Customer performance and follow-up", headers: ["Customer", "Sales", "Gross Profit", "Outstanding", "Last Purchase", "Risk", "Action"], signatures: ["Prepared by", "Sales review", "Owner action"], footerNote: "Customer reports show value, risk and recommended commercial action.", emphasis: "report" };
  }
  if (value.includes("supplier")) {
    return { ...base, accent: "#92400E", soft: "#FFFBEB", label: "Supplier intelligence", table: "Supplier performance and payment history", headers: ["Supplier", "Purchases", "Outstanding", "Delivery Score", "Price Risk", "Last Payment", "Action"], signatures: ["Prepared by", "Procurement review", "Owner action"], footerNote: "Supplier reports support pricing, reliability and payment decisions.", emphasis: "report" };
  }
  if (value.includes("audit") || value.includes("activity") || value.includes("login") || value.includes("approval") || value.includes("data change")) {
    return { ...base, accent: "#0F172A", soft: "#F8FAFC", label: "Audit and compliance evidence", table: "Event trail and control evidence", headers: ["Timestamp", "User", "Module", "Action", "Before", "After", "Evidence"], signatures: ["Generated by", "Reviewed by", "Compliance approval"], footerNote: "Audit reports are read-only evidence of user and system activity.", emphasis: "ledger" };
  }
  if (value.includes("subscription") || value.includes("renewal") || value.includes("usage") || value.includes("license") || value.includes("business setup")) {
    return { ...base, accent: "#1455D9", soft: "#EEF6FF", label: "Subscription and system record", table: "Plan, usage and system entitlement", headers: ["Item", "Plan / License", "Period", "Included", "Used", "Balance", "Status"], signatures: ["Issued by", "Customer", "Solva Trade"], footerNote: "System documents explain billing, license and setup status.", emphasis: "invoice" };
  }
  if (value.includes("executive") || value.includes("business health") || value.includes("morning") || value.includes("kpi") || value.includes("performance") || value.includes("leakage") || value.includes("recovery") || value.includes("action plan") || value.includes("cash position") || value.includes("top products") || value.includes("least performing")) {
    return { ...base, accent: "#071A2B", soft: "#EEF6FF", label: "Executive insight pack", table: "KPIs, risks and recommended actions", headers: ["Area", "Metric", "Current", "Trend", "Risk", "Why It Matters", "Recommended Action"], signatures: ["Prepared by", "Management review", "Owner action"], footerNote: "Executive reports translate business data into clear owner decisions.", emphasis: "report" };
  }
  return base;
}

function blueprintFor(report: Report): DocumentBlueprint {
  return documentBlueprints[report.processName] ?? blueprintFromTerms(report);
}

function templateFor(report: Report): DocumentTemplate {
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  if (value.includes("sales receipt") || value.includes("payment receipt")) return "salesReceipt";
  if (value.includes("receipt voucher")) return "paymentVoucher";
  if (value.includes("tax invoice") || value.includes("etims")) return "taxInvoice";
  if (value.includes("simplified invoice")) return "simplifiedInvoice";
  if (value.includes("proforma")) return "proformaInvoice";
  if (report.processName.toLowerCase() === "invoice") return "taxInvoice";
  if (value.includes("quotation") && !value.includes("request for quotation")) return "quotation";
  if (value.includes("goods received") || value.includes("grn")) return "grn";
  if (value.includes("purchase order") || value.includes("purchase requisition") || value.includes("request for quotation") || value.includes("rfq")) return "purchaseOrder";
  if (value.includes("statement") || value.includes("aging") || value.includes("ageing")) return "statement";
  if (value.includes("dispatch") || value.includes("route") || value.includes("vehicle") || value.includes("pod")) return "dispatchNote";
  if (value.includes("delivery")) return "deliveryNote";
  if (value.includes("credit note") || value.includes("return note")) return "creditNote";
  if (value.includes("debit note")) return "debitNote";
  if (value.includes("cashbook")) return "cashbook";
  if (value.includes("payment voucher") || value.includes("journal voucher") || value.includes("bank deposit")) return "paymentVoucher";
  if (value.includes("stock movement") || value.includes("stock card") || value.includes("bin card")) return "stockMovement";
  if (value.includes("stock") || value.includes("inventory") || value.includes("valuation") || value.includes("reorder")) return "inventoryReport";
  if (value.includes("executive") || value.includes("business health") || value.includes("morning business brief") || value.includes("action plan") || value.includes("kpi")) return "executiveReport";
  if (value.includes("ledger") || value.includes("trial balance") || value.includes("balance sheet") || value.includes("income statement") || value.includes("profit and loss")) return "finance";
  if (value.includes("report") || value.includes("brief") || value.includes("dashboard")) return "report";
  return "taxInvoice";
}

function shouldShowPaymentInstructions(report: Report) {
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    return false;
  }

  const businessName = report.businessName.toLowerCase();
  if ((businessName.includes("cymereg") || businessName.includes("cymreg")) && isDayToDayDocument(report)) {
    return false;
  }

  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  return Boolean(
    report.paymentInstructions.length &&
      (value.includes("invoice") ||
        value.includes("receipt") ||
        value.includes("statement") ||
        value.includes("payment voucher") ||
        value.includes("quotation") ||
        value.includes("proforma") ||
        value.includes("sales order")),
  );
}

function isDayToDayDocument(report: Report) {
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  const dailyTerms = [
    "invoice",
    "receipt",
    "quotation",
    "proforma",
    "goods received",
    "grn",
    "purchase order",
    "purchase requisition",
    "rfq",
    "delivery note",
    "dispatch note",
    "credit note",
    "debit note",
    "payment voucher",
    "receipt voucher",
    "customer statement",
    "supplier statement",
  ];
  const reportTerms = [
    "report",
    "register",
    "trial balance",
    "balance sheet",
    "profit and loss",
    "income statement",
    "cash flow",
    "ledger",
    "audit",
    "compliance",
    "business health",
    "executive",
    "kpi",
    "tax summary",
    "vat report",
    "management accounts",
  ];

  return dailyTerms.some((term) => value.includes(term)) && !reportTerms.some((term) => value.includes(term));
}

function paymentInstructionHtml(report: Report) {
  if (!shouldShowPaymentInstructions(report)) return "";
  return `<article class="payment-instructions">
    <h3>How to pay</h3>
    <ul>${report.paymentInstructions.map((line) => `<li>${htmlEscape(line)}</li>`).join("")}</ul>
  </article>`;
}

function displayTotalEntries(report: Report) {
  if (isCustomerPriceListReport(report.moduleName, report.processName)) {
    return [];
  }

  if (isSupplierProfitReport(report.moduleName, report.processName)) {
    return [
      ["Sales", report.totals.Sales ?? report.totals.Subtotal ?? "KES 0.00"],
      ["Supply cost", report.totals["Supply cost"] ?? report.totals.Discount ?? "KES 0.00"],
      ["Gross profit", report.totals["Gross profit"] ?? report.totals.Total ?? "KES 0.00"],
    ] as [string, string][];
  }

  if (isDayToDayDocument(report)) {
    const total =
      report.totals.Total ??
      report.totals["Amount due"] ??
      report.totals["Amount paid"] ??
      report.totals["Balance due"] ??
      report.totals.Subtotal ??
      "KES 0.00";
    return [["Total", total] as [string, string]];
  }

  const template = templateFor(report);
  const preferredTotals = report.processName === "Invoice"
    ? ["Subtotal", "Total", "Amount due", "Balance due"]
    : template === "salesReceipt"
      ? ["Subtotal", "Tax", "Total", "Amount paid", "Balance due"]
      : ["Subtotal", "Discount", "Tax", "Total", "Amount due", "Balance due"];

  return preferredTotals
    .filter((label, index, list) => report.totals[label] && list.indexOf(label) === index)
    .map((label) => [label, report.totals[label]] as [string, string]);
}

async function tenantContext() {
  const fallback = {
    businessName: "Your company",
    businessLogoPath: null as string | null,
    businessPhone: "",
    businessEmail: "",
    businessLocation: "Kenya",
    paymentInstructions: [] as string[],
    kraPin: "",
    generatedBy: "Solva Trade User",
    generatedByRole: "user",
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return fallback;

    const generatedBy =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email?.split("@")[0] ?? fallback.generatedBy;
    const metadataBusinessId = typeof user.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null;
    const preferredBusinessId = await getActiveBusinessId();
    const metadataBusinessName = typeof user.app_metadata?.business_name === "string" ? user.app_metadata.business_name : fallback.businessName;
    const metadataKraPin = typeof user.app_metadata?.business_kra_pin === "string" ? user.app_metadata.business_kra_pin : "";
    const metadataPhone = typeof user.app_metadata?.business_phone === "string" ? user.app_metadata.business_phone : "";
    const metadataEmail = typeof user.app_metadata?.business_email === "string" ? user.app_metadata.business_email : "";
    const metadataLocation = typeof user.app_metadata?.business_location === "string" ? user.app_metadata.business_location : fallback.businessLocation;
    const membershipQuery = (db: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>) => {
      let query = db
        .from("business_memberships")
        .select("business_id, role")
        .eq("user_id", user.id)
        .eq("active", true);
      if (preferredBusinessId) query = query.eq("business_id", preferredBusinessId);
      return query.order("joined_at", { ascending: true }).limit(1).maybeSingle();
    };

    let membership: { business_id: string | null; role: string | null } | null = null;
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await membershipQuery(admin);
      membership = data;
    } catch {
      const { data } = await membershipQuery(supabase);
      membership = data;
    }

    if (!membership?.business_id && preferredBusinessId) {
      const { data } = await supabase
        .from("business_memberships")
        .select("business_id, role")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      membership = data;
    }

    const businessId = membership?.business_id ?? metadataBusinessId;
    const generatedByRole = String(membership?.role ?? user.app_metadata?.business_role ?? fallback.generatedByRole);
    const metadataTenant = {
      businessName: metadataBusinessName,
      businessLogoPath: null,
      businessPhone: metadataPhone,
      businessEmail: metadataEmail,
      businessLocation: metadataLocation,
      paymentInstructions: [] as string[],
      kraPin: metadataKraPin,
      generatedBy,
      generatedByRole,
    };
    if (!businessId) return { ...fallback, ...metadataTenant };

    let business:
      | {
          trading_name: string | null;
          legal_name: string | null;
          logo_path: string | null;
          phone: string | null;
          email: string | null;
          physical_address: string | null;
          county: string | null;
          country: string | null;
          kra_pin: string | null;
          payment_details: unknown;
        }
      | null = null;

    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("businesses")
        .select("trading_name, legal_name, logo_path, phone, email, physical_address, county, country, kra_pin, payment_details")
        .eq("id", businessId)
        .maybeSingle();
      business = data;
    } catch {
      const { data } = await supabase
        .from("businesses")
        .select("trading_name, legal_name, logo_path, phone, email, physical_address, county, country, kra_pin, payment_details")
        .eq("id", businessId)
        .maybeSingle();
      business = data;
    }

    if (!business) return { ...fallback, ...metadataTenant };
    const businessLogoPath = await signedBusinessLogoPath(business.logo_path);
    const businessName = displayBusinessName(business.trading_name ?? business.legal_name ?? fallback.businessName);
    const businessPhone = business.phone ?? metadataPhone;

    return {
      businessName,
      businessLogoPath,
      businessPhone,
      businessEmail: business.email ?? metadataEmail,
      businessLocation: [business.physical_address, business.county, business.country].filter(Boolean).join(", ") || metadataLocation,
      paymentInstructions: paymentInstructions(paymentDetailsFromJson(business.payment_details), businessName, businessPhone),
      kraPin: business.kra_pin ?? metadataKraPin,
      generatedBy,
      generatedByRole,
    };
  } catch {
    return fallback;
  }
}

async function buildReport(searchParams: URLSearchParams): Promise<Report> {
  const tenant = await tenantContext();
  const moduleName = searchParams.get("module") ?? "Solva Trade";
  const processName = searchParams.get("process") ?? "Business Process";
  const productId = searchParams.get("productId");
  const customerId = searchParams.get("customerId");
  const invoiceId = searchParams.get("invoiceId");
  const grnId = searchParams.get("grnId");
  const fields = submittedFields(searchParams);
  const partyName =
    searchParams.get("customer") ??
    searchParams.get("company") ??
    searchParams.get("user") ??
    searchParams.get("party") ??
    fieldValue(fields, ["customer", "supplier", "received_from", "paid_to", "payee", "owner", "driver", "employee"], tenant.businessName);
  const generatedBy = personInitials(searchParams.get("generatedBy") ?? searchParams.get("printer") ?? tenant.generatedBy);
  const customerStatementReport =
    isCustomerSalesStatementReport(moduleName, processName) ||
    processName.toLowerCase().includes("profit by customer") ||
    processName.toLowerCase().includes("customer profit");
  const selectedCustomerName =
    customerId && customerId !== "all" && (isCustomerPriceListReport(moduleName, processName) || customerStatementReport)
      ? await customerNameForReport(customerId)
      : "";
  const priceListCustomerName = isCustomerPriceListReport(moduleName, processName) ? selectedCustomerName : "";
  const submittedLines = isProfileDocument(moduleName, processName) ? profileLinesFromFields(fields, processName) : reportLineFromFields(fields, processName);
  const liveSourceLines = invoiceId
    ? await salesInvoiceDocumentLines(invoiceId)
    : grnId
      ? await goodsReceivedDocumentLines(grnId)
      : isPurchaseSourceReport(processName)
        ? await purchaseSourceReportLines(processName)
        : isCustomerSalesStatementReport(moduleName, processName)
          ? await customerStatementReportLines(searchParams)
        : processName.toLowerCase().includes("profit by customer") ||
            processName.toLowerCase().includes("customer profit")
          ? await profitByCustomerReportLines(searchParams)
        : processName.toLowerCase().includes("profit by supplier") || processName.toLowerCase().includes("supplier source profit")
          ? await profitBySupplierSourceReportLines(searchParams)
        : isSalesSourceReport(processName)
          ? await salesSourceReportLines(processName)
          : isFinancialStatementReport(moduleName, processName)
          ? await financialStatementReportLines(processName)
          : isKraEtrSalesReport(moduleName, processName)
            ? await kraEtrSalesReportLines()
            : isExpenseOperationalReport(moduleName, processName)
              ? await expenseOperationalReportLines(processName)
            : isSalesOperationalReport(moduleName, processName)
              ? await salesOperationalReportLines(processName, searchParams)
        : isProductProfileReport(moduleName, processName)
          ? await productMasterReportLines(productId)
          : isCustomerPriceListReport(moduleName, processName)
            ? await customerPriceListReportLines(searchParams)
          : isCustomerProfileReport(moduleName, processName)
            ? await customerProfileReportLines(customerId)
        : isProductMasterReport(moduleName, processName)
          ? await productMasterReportLines()
          : isInventoryOperationalReport(moduleName, processName)
            ? await inventoryOperationalReportLines(processName)
            : [];
  const workflowLines = !liveSourceLines.length && !submittedLines.length ? await workflowRecordReportLines(moduleName, processName) : [];
  const lines = liveSourceLines.length ? liveSourceLines : submittedLines.length ? submittedLines : workflowLines;
  const liveInvoiceDetails = invoiceId ? lines[0]?.details ?? {} : {};
  const liveGrnDetails = grnId ? lines[0]?.details ?? {} : {};
  const lineCustomerName =
    customerStatementReport && customerId && customerId !== "all"
      ? String(lines.find((line) => String(line.details?.Customer ?? "").trim())?.details?.Customer ?? "").trim()
      : "";
  const customerStatementPartyName = customerStatementReport
    ? selectedCustomerName || lineCustomerName || searchParams.get("customer") || "All customers"
    : "";
  const effectivePartyName = liveInvoiceDetails.Customer || liveGrnDetails.Supplier || priceListCustomerName || customerStatementPartyName || partyName;
  const isValuationReport = isProductMasterReport(moduleName, processName) || isProductProfileReport(moduleName, processName) || isInventoryOperationalReport(moduleName, processName);
  const isCustomerSalesProfit = isCustomerSalesProfitReport(moduleName, processName);
  const isCustomerStatement = isCustomerSalesStatementReport(moduleName, processName);
  const isSupplierProfit = isSupplierProfitReport(moduleName, processName);
  const lineValueTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const customerStatementDebitTotal = isCustomerStatement
    ? lines.reduce((sum, line) => sum + detailAmount(line.details?.Debit), 0)
    : 0;
  const customerStatementCreditTotal = isCustomerStatement
    ? lines.reduce((sum, line) => sum + detailAmount(line.details?.Credit), 0)
    : 0;
  const customerStatementOpeningBalance = isCustomerStatement ? detailAmount(lines[0]?.details?.["Opening balance"]) : 0;
  const customerStatementClosingBalance = isCustomerStatement
    ? detailAmount(lines.at(-1)?.details?.Balance)
    : 0;
  const supplierProfitSalesTotal = isSupplierProfit
    ? lines.reduce((sum, line) => sum + detailAmount(line.details?.Sales ?? money(line.discount)), 0)
    : 0;
  const supplierProfitCostTotal = isSupplierProfit
    ? lines.reduce((sum, line) => sum + detailAmount(line.details?.["Supply cost"] ?? money(line.unitPrice)), 0)
    : 0;
  const supplierProfitGrossTotal = isSupplierProfit
    ? lines.reduce((sum, line) => sum + detailAmount(line.details?.["Gross profit"] ?? money(line.lineTotal)), 0)
    : 0;
  const isLiveCustomerInvoice = Boolean(invoiceId && liveInvoiceDetails["Invoice no."]);
  const liveInvoiceLineTotal = isLiveCustomerInvoice && lineValueTotal > 0 ? lineValueTotal : 0;
  const liveInvoiceTotals = invoiceId && lines[0]?.details
    ? {
        subtotal: liveInvoiceLineTotal || detailAmount(lines[0].details["Invoice subtotal"]),
        tax: 0,
        total: liveInvoiceLineTotal || detailAmount(lines[0].details["Invoice total"]),
        paid: detailAmount(lines[0].details["Amount paid"]),
        balance: Math.max(0, (liveInvoiceLineTotal || detailAmount(lines[0].details["Invoice total"])) - detailAmount(lines[0].details["Amount paid"])),
        status: lines[0].details["Payment status"] ?? "",
      }
    : null;
  const subtotal = isValuationReport
    ? lineValueTotal
    : isCustomerStatement
      ? customerStatementDebitTotal
    : isSupplierProfit
      ? supplierProfitSalesTotal
    : liveInvoiceTotals?.subtotal
      ? liveInvoiceTotals.subtotal
    : parseAmount(fieldValue(fields, ["subtotal"], "0")) ||
      lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - line.discount), 0);
  const tax = isValuationReport
    ? 0
    : isCustomerSalesProfit
      ? 0
    : liveInvoiceTotals
      ? liveInvoiceTotals.tax
      : parseAmount(fieldValue(fields, ["tax"], "0")) || lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const discount = isValuationReport || isLiveCustomerInvoice
    ? 0
    : isCustomerStatement
      ? customerStatementCreditTotal
    : isSupplierProfit
      ? supplierProfitCostTotal
      : parseAmount(fieldValue(fields, ["discount"], "0")) || lines.reduce((sum, line) => sum + line.discount, 0);
  const total =
    (isValuationReport
      ? lineValueTotal
      : isCustomerStatement
        ? customerStatementClosingBalance
      : isSupplierProfit
        ? supplierProfitGrossTotal
        : liveInvoiceTotals?.total || parseAmount(fieldValue(fields, ["total", "amount", "amount_received", "amount_sent"], "0"))) ||
    lineValueTotal ||
    Math.max(0, subtotal - discount + tax);
  const balanceDueField = fieldValue(fields, ["balance_due", "outstanding_amount"], "");
  const amountPaid = liveInvoiceTotals ? liveInvoiceTotals.paid : parseAmount(fieldValue(fields, ["amount_paid", "amount_received", "paid"], "0"));
  const balanceDue = liveInvoiceTotals
    ? liveInvoiceTotals.balance
    : balanceDueField
      ? parseAmount(balanceDueField)
      : Math.max(0, total - amountPaid);
  const reference =
    liveInvoiceDetails["Invoice no."] ||
    liveGrnDetails["GRN no."] ||
    fieldValue(fields, [
      "invoice_number",
      "receipt_number",
      "payment_number",
      "quotation_number",
      "sales_order_number",
      "po_number",
      "grn_number",
      "bill_number",
      "document_number",
      "return_number",
      "transfer_number",
      "adjustment_number",
      "count_number",
    ]) || `${moduleName.slice(0, 3).toUpperCase()}-${processName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const documentDate = liveInvoiceDetails.Date || liveGrnDetails["Receipt date"] || fieldValue(fields, ["invoice_date", "receipt_date", "payment_date", "received_date", "date", "delivery_date", "needed_by", "as_of_date"], todayIsoDate());
  const dueDate = fieldValue(fields, ["due_date", "valid_until", "expected_date", "expiry_date", "expected_arrival"], documentDate);
  let processStatus = "Ready for review";
  let sourceAuditNote = lines.length ? "Document values come from the submitted workflow fields." : "No posted transaction rows were found for the selected filters.";
  if (liveSourceLines.length) {
    if (isProductProfileReport(moduleName, processName)) {
      processStatus = "Live product profile from saved inventory records";
      sourceAuditNote = "Product profile values come from the saved product, product setup details, stock balance, pack conversion and latest purchase receipt.";
    } else if (isProductMasterReport(moduleName, processName)) {
      processStatus = "Live product master from saved inventory records";
      sourceAuditNote = "Product master values come from saved products, product setup details, pack conversions, stock balances and latest purchase receipts.";
    } else if (isCustomerPriceListReport(moduleName, processName)) {
      processStatus = "Customer price list prepared from saved inventory records";
      sourceAuditNote = "Catalogue values come from saved products and the customer-specific prices entered before generation.";
    } else if (isCustomerProfileReport(moduleName, processName)) {
      processStatus = "Live customer profile from saved customer records";
      sourceAuditNote = "Customer profile values come from the saved customer record, default address, branch, credit limit, balance, contact details and payment terms.";
    } else if (isInventoryOperationalReport(moduleName, processName)) {
      processStatus = "Live inventory report from saved products, balances, movement and sales allocation records";
      sourceAuditNote = "Inventory report values come from saved products, stock balances, reorder controls, latest receipts and posted sales allocations where applicable.";
    } else if (isSalesOperationalReport(moduleName, processName)) {
      processStatus = "Live sales report from posted invoices, invoice items, customers and source-cost allocations";
      sourceAuditNote = "Sales report values come from posted invoices, invoice items, customers, branches and FIFO/source-cost allocations where available.";
    } else if (isKraEtrSalesReport(moduleName, processName)) {
      const period = kraEtrMonthlyWindow();
      processStatus = "Live KRA ETR sales register for VAT preparation";
      sourceAuditNote = `KRA ETR rows come from posted sales invoice items dated ${period.start} to ${period.end}, customer KRA PINs, tenant tax device settings and recorded external CUI references where available.`;
    } else if (isExpenseOperationalReport(moduleName, processName)) {
      const period = expenseReportPeriod(processName);
      processStatus = "Live expense report from posted office expenses";
      sourceAuditNote = `Expense rows come from posted expenses dated ${period.start} to ${period.end}, including amount spent, optional input VAT, payee, paid-from source and notes.`;
    } else if (isFinancialStatementReport(moduleName, processName)) {
      processStatus = "Live financial statement from posted journal account activity";
      sourceAuditNote = "Financial statement values come from posted journal account activity and statement classification mappings.";
    } else if (isSalesSourceReport(processName)) {
      processStatus = "Source report from posted receipts";
      sourceAuditNote = "Source profit values come from FIFO allocation of posted sales against received stock cost layers.";
    } else {
      processStatus = "Source report from posted receipts";
      sourceAuditNote = "Source report values come from posted GRNs and stock receipt movements.";
    }
  } else if (workflowLines.length) {
    sourceAuditNote = "Report rows come from saved tenant workflow records for this module and process.";
  }

  return {
    moduleName,
    processName,
    partyName: effectivePartyName,
    businessName: tenant.businessName,
    businessLogoPath: tenant.businessLogoPath,
    businessPhone: tenant.businessPhone,
    businessEmail: tenant.businessEmail,
    businessLocation: tenant.businessLocation,
    paymentInstructions: tenant.paymentInstructions,
    kraPin: tenant.kraPin,
    generatedBy,
    generatedByRole: tenant.generatedByRole,
    generatedAt: generatedAt(),
    transaction: {
      "Report owner": effectivePartyName,
      Business: tenant.businessName,
      "KRA PIN": tenant.kraPin || "Not provided",
      Customer: effectivePartyName,
      Supplier: liveGrnDetails.Supplier || fieldValue(fields, ["supplier", "preferred_supplier"], ""),
      "Invoice no.": liveInvoiceDetails["Invoice no."] || fieldValue(fields, ["invoice_number"], reference),
      "GRN no.": liveGrnDetails["GRN no."] || fieldValue(fields, ["grn_number"], ""),
      "Supplier delivery note": liveGrnDetails["Supplier delivery note"] || fieldValue(fields, ["supplier_delivery_note_number"], ""),
      "Reference number": reference,
      "Document date": documentDate,
      "Due or action date": dueDate,
      Branch: fieldValue(fields, ["branch", "dispatch_warehouse", "warehouse", "route"], "Main workspace"),
      Currency: "KES",
      "Payment terms": fieldValue(fields, ["payment_terms", "payment_status", "payment_method", "delivery_terms"], "As entered"),
      "Payment status": liveInvoiceTotals?.status || fieldValue(fields, ["payment_status"], ""),
      "Payment instructions": tenant.paymentInstructions.join(" | ") || "Not configured",
      "Process status": processStatus,
      "Source workspace": moduleName,
      "Business process": processName,
      ...Object.fromEntries(Object.values(fields).map((field) => [field.label, field.value])),
    },
    lines,
    totals: {
      Subtotal: money(subtotal),
      Discount: money(discount),
      ...(isCustomerStatement ? { "Opening balance": money(customerStatementOpeningBalance), Invoices: money(customerStatementDebitTotal), Payments: money(customerStatementCreditTotal), "Closing balance": money(customerStatementClosingBalance) } : {}),
      ...(isSupplierProfit ? { Sales: money(supplierProfitSalesTotal), "Supply cost": money(supplierProfitCostTotal), "Gross profit": money(supplierProfitGrossTotal) } : {}),
      ...(isCustomerSalesProfit ? {} : { Tax: money(tax) }),
      Total: money(total),
      ...(processName.toLowerCase().includes("invoice") ? { "Amount due": money(balanceDue) } : {}),
      "Amount paid": money(amountPaid),
      "Balance due": money(balanceDue),
    },
    approvals: approvalSummary(generatedBy, tenant.generatedByRole),
    auditTrail: [
      "Created from the selected Solva Trade process.",
      "Includes header details, line details, totals, approval state, and audit context.",
      "CSV output protects spreadsheet users from formula injection.",
      `Tenant identity: ${tenant.businessName}${tenant.kraPin ? `, KRA PIN ${tenant.kraPin}` : ""}.`,
      sourceAuditNote,
      tenant.paymentInstructions.length ? "Tenant payment instructions are included from the business payment settings." : "Tenant payment instructions are not configured yet.",
      "Company logos are included when the business profile provides one; Solva Trade branding and watermark remain on every report.",
    ],
  };
}

function csv(report: Report) {
  const reportHeaders = lineHeaders(report);
  const suppressTax = isCustomerSalesProfitReport(report.moduleName, report.processName);
  const baseDetailHeaders = [
    "module",
    "process",
    "business_name",
    "business_location",
    "business_phone",
    "business_email",
    "payment_instructions",
    "kra_pin",
    "report_owner",
    "generated_by",
    "generated_at",
    "reference_number",
    "document_date",
    "due_or_action_date",
    "branch",
    "currency",
    "payment_terms",
    "process_status",
    "sku",
    "description",
    "unit",
    "quantity",
    "unit_price",
    "discount",
    "tax_rate",
    "tax_amount",
    "line_total",
    "warehouse",
    "batch",
    "line_notes",
    "subtotal",
    "total_tax",
    "grand_total",
    "balance_due",
    "prepared_by",
    "review_status",
    "approval_status",
    "audit_notes",
    ...reportHeaders.map((header) => `report_${header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`),
  ];
  const detailHeaders = suppressTax
    ? baseDetailHeaders.filter((header) => !["tax_rate", "tax_amount", "total_tax"].includes(header))
    : baseDetailHeaders;
  const auditNotes = report.auditTrail.join(" | ");
  const rows = report.lines.map((line, index) => {
    const cells = lineCells(report, line, index);
    const rowByHeader: Record<string, string> = {
      module: report.moduleName,
      process: report.processName,
      business_name: report.businessName,
      business_location: report.businessLocation,
      business_phone: report.businessPhone,
      business_email: report.businessEmail,
      payment_instructions: report.paymentInstructions.join(" | "),
      kra_pin: report.kraPin,
      report_owner: report.partyName,
      generated_by: report.generatedBy,
      generated_at: report.generatedAt,
      reference_number: report.transaction["Reference number"],
      document_date: report.transaction["Document date"],
      due_or_action_date: report.transaction["Due or action date"],
      branch: report.transaction.Branch,
      currency: report.transaction.Currency,
      payment_terms: report.transaction["Payment terms"],
      process_status: report.transaction["Process status"],
      sku: line.sku,
      description: line.description,
      unit: line.unit,
      quantity: String(line.quantity),
      unit_price: money(line.unitPrice),
      discount: money(line.discount),
      tax_rate: line.taxRate,
      tax_amount: money(line.taxAmount),
      line_total: money(line.lineTotal),
      warehouse: line.warehouse,
      batch: line.batch,
      line_notes: line.notes,
      subtotal: report.totals.Subtotal,
      total_tax: report.totals.Tax ?? "",
      grand_total: report.totals.Total,
      balance_due: report.totals["Balance due"],
      prepared_by: report.approvals.Prepared,
      review_status: report.approvals.Reviewed,
      approval_status: report.approvals.Approved,
      audit_notes: auditNotes,
    };
    reportHeaders.forEach((header, headerIndex) => {
      rowByHeader[`report_${header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`] = cells[headerIndex] ?? "";
    });
    return detailHeaders.map((header) => rowByHeader[header] ?? "");
  });

  return [detailHeaders, ...rows]
    .map((row) => row.map((value) => `"${csvSafe(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function logoHtml(report: Report) {
  if (report.businessLogoPath) {
    return `<img src="${htmlEscape(report.businessLogoPath)}" alt="${htmlEscape(report.businessName)} logo" />`;
  }
  const cleanBusinessName = report.businessName.toLowerCase();
  if (cleanBusinessName.includes("cymereg") || cleanBusinessName.includes("cymreg")) {
    return `<img src="/cymereg-enterprises-logo.svg" alt="Cymreg Enterprises logo" />`;
  }
  return `<span>${htmlEscape(initials(report.businessName))}</span>`;
}

async function signedBusinessLogoPath(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.from("business-assets").createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

async function imageBufferFromPath(imagePath: string | null | undefined) {
  if (!imagePath) return null;
  try {
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      const response = await fetch(imagePath, { cache: "no-store" });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    const publicPath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    return await fs.readFile(path.join(process.cwd(), "public", publicPath));
  } catch {
    return null;
  }
}

async function makePdfImage(name: string, source: string | null | undefined, maxWidth: number, maxHeight: number): Promise<PdfImageResource | null> {
  const input = await imageBufferFromPath(source);
  if (!input) return null;
  try {
    const { data, info } = await sharp(input)
      .flatten({ background: "#ffffff" })
      .resize({ width: Math.round(maxWidth * 4), height: Math.round(maxHeight * 4), fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { name, data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

async function pdfAssets(report: Report, layout: "portrait" | "landscape") {
  const tenant = await makePdfImage("TenantLogo", report.businessLogoPath, layout === "landscape" ? 112 : 92, layout === "landscape" ? 58 : 72);
  const solva = await makePdfImage("SolvaLogo", "/solva-trade-logo.png", layout === "landscape" ? 120 : 136, layout === "landscape" ? 42 : 42);
  return [tenant, solva].filter(Boolean) as PdfImageResource[];
}

function drawFittedImage(canvas: PdfCanvas, image: PdfImageResource | undefined, x: number, y: number, maxWidth: number, maxHeight: number) {
  if (!image) return false;
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  canvas.image(image.name, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
  return true;
}

function lineHeaders(report: Report) {
  if (isCustomerFacingInvoice(report)) {
    return ["Serial No.", "Description", "Quantity", "Unit Price", "Discount", "Amount Payable"];
  }
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    return ["#", "Date", "Document No.", "Type", "Description", "Debit", "Credit", "Balance"];
  }
  if (value.includes("profit by supplier") || value.includes("supplier source profit")) {
    return ["#", "Source", "Supplier", "Period", "Products", "Units sold", "Sales", "Supply cost", "Gross profit", "Margin"];
  }
  return blueprintFor(report).headers;
}

function isCustomerFacingInvoice(report: Report) {
  const template = templateFor(report);
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  const invoiceLike = value.includes("invoice") || value.includes("quotation") || value.includes("proforma");
  const nonCustomerInvoice =
    value.includes("receipt") ||
    value.includes("statement") ||
    value.includes("register") ||
    value.includes("summary report") ||
    value.includes("sales report") ||
    value.includes("purchase report") ||
    value.includes("supplier invoice");

  return (
    ["invoice", "taxInvoice", "simplifiedInvoice", "proformaInvoice", "quotation"].includes(template) &&
    invoiceLike &&
    !nonCustomerInvoice
  );
}

function isPlainCustomerInvoice(report: Report) {
  if (!isCustomerFacingInvoice(report)) return false;
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  return value.includes("invoice") && !value.includes("proforma") && !value.includes("quotation");
}

function isCustomerSalesProfitReport(moduleName: string, processName: string) {
  return isCustomerSalesStatementReport(moduleName, processName) || isSupplierProfitReport(moduleName, processName);
}

function isCustomerSalesStatementReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ");
  return (
    value.includes("customer sales statement") ||
    value.includes("customer sales and profit") ||
    value.includes("sales generation per customer")
  );
}

function isSupplierProfitReport(moduleName: string, processName: string) {
  const value = `${moduleName} ${processName}`.toLowerCase();
  return value.includes("profit by supplier") || value.includes("supplier source profit");
}

function allocationCost(row: { quantity?: number | string | null; unit_cost?: number | string | null; total_cost?: number | string | null }) {
  const storedCost = numberValue(row.total_cost);
  if (storedCost) return storedCost;
  return numberValue(row.quantity) * numberValue(row.unit_cost);
}

function allocationSaleValue(row: { quantity?: number | string | null; sale_unit_price?: number | string | null; sale_value?: number | string | null }) {
  const storedSale = numberValue(row.sale_value);
  if (storedSale) return storedSale;
  return numberValue(row.quantity) * numberValue(row.sale_unit_price);
}

function authoritativeAllocationSaleValue(row: {
  quantity?: number | string | null;
  sale_unit_price?: number | string | null;
  sale_value?: number | string | null;
  sales_invoice_items?:
    | { invoice_quantity?: number | string | null; unit_price?: number | string | null; line_total?: number | string | null }
    | { invoice_quantity?: number | string | null; unit_price?: number | string | null; line_total?: number | string | null }[]
    | null;
}) {
  const invoiceItem = relatedOne(row.sales_invoice_items);
  const itemQuantity = numberValue(invoiceItem?.invoice_quantity);
  const itemTotal = numberValue(invoiceItem?.line_total);
  if (itemQuantity > 0 && itemTotal > 0) return numberValue(row.quantity) * (itemTotal / itemQuantity);
  return allocationSaleValue(row);
}

function allocationGrossProfit(row: {
  quantity?: number | string | null;
  unit_cost?: number | string | null;
  total_cost?: number | string | null;
  sale_unit_price?: number | string | null;
  sale_value?: number | string | null;
}) {
  return allocationSaleValue(row) - allocationCost(row);
}

function requireOwnerProfitPin(searchParams: URLSearchParams, moduleName: string, processName: string) {
  if (!isSupplierProfitReport(moduleName, processName)) return null;
  if (searchParams.get("ownerPin") === "2027") return null;
  return new Response("Owner PIN required to generate this profit report.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function valueForHeader(report: Report, line: ReportLine, index: number, header: string) {
  const h = header.toLowerCase();
  const directDetail = line.details?.[header];
  if (directDetail !== undefined) return directDetail;
  const matchingDetail = Object.entries(line.details ?? {}).find(([key]) => key.toLowerCase() === h);
  if (matchingDetail) return matchingDetail[1];
  if (h === "#" || h.includes("s/no") || h.includes("serial") || h.includes("line") || h.includes("stop")) return String(index + 1);
  if (h === "item name" || h === "name" || h === "product name") return detailValue(line, "Product name", detailValue(line, "Item name", line.description));
  if (h === "item no." || h === "item number") return detailValue(line, "Product code", detailValue(line, "Item no.", line.sku));
  if (h.includes("brand")) return detailValue(line, "Brand", line.notes);
  if (h.includes("category")) return detailValue(line, "Category", line.notes);
  if (h.includes("base unit")) return detailValue(line, "Base stock unit", detailValue(line, "Base unit", line.unit));
  if (h.includes("selling price")) return detailValue(line, "Selling price", detailValue(line, "Selling price placeholder", money(line.unitPrice)));
  if (h.includes("vat treatment")) return detailValue(line, "VAT treatment", line.taxRate);
  if (h.includes("timestamp")) return report.generatedAt;
  if (h.includes("date") || h.includes("period") || h.includes("needed by") || h.includes("expiry")) return report.transaction["Document date"];
  if (h.includes("document") || h.includes("reference") || h.includes("ref") || h.includes("invoice") || h.includes("po") || h.includes("voucher") || h.includes("receipt") || h.includes("req")) return report.transaction["Reference number"];
  if (h.includes("source")) return line.batch;
  if (h.includes("supplier")) return line.warehouse;
  if (h.includes("customer") || h.includes("party") || h.includes("payee") || h.includes("received from") || h.includes("recipient")) return report.partyName;
  if (h.includes("description") || h.includes("particular") || h.includes("item") || h.includes("product") || h.includes("specification") || h.includes("account name") || h.includes("activity")) return line.description;
  if (h.includes("sku") || h.includes("code") || h.includes("account code")) return line.sku;
  if (h.includes("unit") && !h.includes("price")) return line.unit;
  if (h.includes("ordered")) return String(line.quantity);
  if (h.includes("delivered") || h.includes("received") || h.includes("accepted") || h.includes("loaded") || h.includes("picked") || h.includes("counted") || h.includes("sent")) return String(line.quantity);
  if (h.includes("benchmark")) return line.discount ? money(line.discount) : "Not entered";
  if (h.includes("variance")) return money(line.taxAmount);
  if (h.includes("returned") || h.includes("rejected") || h.includes("backorder")) return "0";
  if (h.includes("outstanding") || h.includes("running balance") || h === "balance" || h.includes("closing")) return money(line.lineTotal);
  if (h.includes("qty") || h.includes("quantity") || h.includes("on hand")) return String(line.quantity);
  if (h.includes("tax") || h.includes("vat")) return h.includes("rate") ? line.taxRate : money(line.taxAmount);
  if (h.includes("sale price")) return money(line.discount);
  if (h.includes("cost value")) return money(line.taxAmount);
  if (h.includes("price") || h.includes("rate") || h.includes("cost")) return money(line.unitPrice);
  if (h.includes("discount")) return money(line.discount);
  if (h.includes("money out") || h.includes("credit") || h.includes("paid")) return money(line.discount);
  if (h.includes("margin")) return line.taxRate;
  if (h.includes("profit")) return money(line.lineTotal);
  if (h.includes("money in") || h.includes("debit") || h.includes("gross") || h.includes("amount") || h.includes("value") || h.includes("total") || h.includes("cash") || h.includes("sales") || h.includes("purchases") || h.includes("outstanding")) return money(line.lineTotal);
  if (h.includes("warehouse") || h.includes("branch") || h.includes("route") || h.includes("vehicle") || h.includes("location") || h.includes("from") || h.includes("to") || h.includes("bin")) return line.warehouse;
  if (h.includes("batch")) return line.batch;
  if (h.includes("status") || h.includes("approval")) return report.transaction["Process status"];
  if (h.includes("condition")) return "Accepted";
  if (h.includes("risk")) return line.taxRate.includes("No tax") ? "Low" : "Review";
  if (h.includes("action") || h.includes("reason") || h.includes("remark") || h.includes("note") || h.includes("instruction")) return line.notes;
  if (h.includes("metric") || h.includes("current") || h.includes("trend")) return line.lineTotal ? money(line.lineTotal) : "Ready";
  return line.notes || "";
}

function lineCells(report: Report, line: ReportLine, index: number) {
  return lineHeaders(report).map((header) => valueForHeader(report, line, index, header));
}

function roleLabel(role: string) {
  if (role === "owner") return "Business Owner";
  if (role === "manager") return "Manager";
  if (role === "staff") return "Staff";
  return "User";
}

function approvalSummary(generatedBy: string, role: string): Record<string, string> {
  if (role === "owner") {
    return {
      "Issued by": `${generatedBy} - Business Owner`,
      "Approval status": "Owner-issued document. No additional approval required.",
      "Authority": "Final business approval",
      "Audit status": "Tenant scoped and export logged",
    };
  }
  if (role === "manager") {
    return {
      Prepared: `${generatedBy} - Manager`,
      Reviewed: "Manager-issued document",
      Approved: "Owner approval required only where business policy demands it",
      "Audit status": "Tenant scoped and export logged",
    };
  }
  return {
    Prepared: `${generatedBy} - ${roleLabel(role)}`,
    Reviewed: "Pending manager review",
    Approved: "Pending owner approval where required",
    "Audit status": "Tenant scoped and export logged",
  };
}

function signatureLabelsFor(report: Report) {
  if (isCustomerPriceListReport(report.moduleName, report.processName)) {
    return [];
  }

  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    return [];
  }

  if (isDayToDayDocument(report)) {
    const template = templateFor(report);
    if (template === "grn") return ["Received by", "Checked by", "Date"];
    if (template === "purchaseOrder") return ["Prepared by", "Supplier", "Date"];
    if (template === "deliveryNote" || template === "dispatchNote") return ["Delivered by", "Received by", "Date"];
    return ["Prepared by", "Customer", "Date"];
  }
  if (report.generatedByRole === "owner") {
    return ["Issued by Business Owner", "Received / acknowledged by", "Date and stamp"];
  }
  return blueprintFor(report).signatures.slice(0, 3);
}

function catalogueFooterText(report: Report) {
  return `${report.businessName} document generated by Solva Trade. Prices are customer-specific for this catalogue and should be confirmed before invoicing if market prices change. Generated on ${report.generatedAt}.`;
}

function splitForPdfCell(value: string, maxChars: number) {
  const matcher = new RegExp(`.{1,${maxChars}}`, "g");
  return String(value || "-")
    .split(/\s+/)
    .flatMap((word) => (word.length > maxChars ? word.match(matcher) ?? [word] : [word]))
    .filter((word): word is string => Boolean(word));
}

function wrapLineCount(value: string, maxWidth: number, size: number, maxLines = 4) {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.48)));
  const words = splitForPdfCell(value, maxChars);
  if (!words.length) return 1;
  let lines = 0;
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines += 1;
      current = word;
      if (lines >= maxLines) return maxLines;
    } else {
      current = next;
    }
  }
  if (current) lines += 1;
  return Math.min(maxLines, Math.max(1, lines));
}

function documentMetaCard(report: Report) {
  return `
    <dl class="meta-card">
      <div><dt>Document No.</dt><dd>${htmlEscape(report.transaction["Reference number"])}</dd></div>
      <div><dt>Date</dt><dd>${htmlEscape(report.transaction["Document date"])}</dd></div>
      <div><dt>Terms</dt><dd>${htmlEscape(report.transaction["Payment terms"])}</dd></div>
      <div><dt>Due / Action Date</dt><dd>${htmlEscape(report.transaction["Due or action date"])}</dd></div>
    </dl>
  `;
}

function introValue(report: Report, kind: string) {
  if (kind === "party") return `<p class="party">${htmlEscape(report.partyName)}</p><p>${htmlEscape(report.transaction.Branch)}</p>`;
  if (kind === "meta") return documentMetaCard(report);
  return `<p>${htmlEscape(report.processName)} is prepared from the submitted workflow values and tenant records.</p>`;
}

function introCards(report: Report, columns: "two-column" | "invoice-grid" | "po-grid" | "grn-grid") {
  if (isDayToDayDocument(report)) {
    const template = templateFor(report);
    const partyTitle = template === "grn" || template === "purchaseOrder" ? "Supplier" : "Bill to";
    const shipTitle = template === "grn" || template === "purchaseOrder" ? "Receive at" : "Ship to";
    const showShipBlock = template === "grn" || template === "purchaseOrder" || template === "deliveryNote" || template === "dispatchNote";
    return `
      <section class="daily-document-grid ${showShipBlock ? "" : "daily-document-grid-simple"}">
        <article class="box">
          <h3>${htmlEscape(partyTitle)}</h3>
          <p class="party">${htmlEscape(report.partyName)}</p>
        </article>
        ${
          showShipBlock
            ? `<article class="box">
          <h3>${htmlEscape(shipTitle)}</h3>
          <p class="party">${htmlEscape(template === "grn" || template === "purchaseOrder" ? report.businessName : report.partyName)}</p>
        </article>`
            : ""
        }
        <article class="box">
          <h3>${htmlEscape(report.processName)} details</h3>
          ${documentMetaCard(report)}
        </article>
      </section>
    `;
  }
  const blueprint = blueprintFor(report);
  return `
    <section class="${columns}">
      ${blueprint.intro
        .map(([title, description, kind], index) => `<article class="box ${index === 0 && blueprint.emphasis === "invoice" && blueprint.label.toLowerCase().includes("supplier") ? "dark" : ""}">
          <h3>${htmlEscape(title)}</h3>
          ${introValue(report, kind)}
          <p class="small-note">${htmlEscape(description)}</p>
        </article>`)
        .join("")}
    </section>
  `;
}

function templateIntro(report: Report) {
  const blueprint = blueprintFor(report);
  const template = templateFor(report);
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    const period = report.lines[0]?.details?.Period ?? `${report.transaction["Document date"]} to ${report.transaction["Due / action date"]}`;
    return `
      <section class="statement-summary compact-statement-summary">
        <div><span>Customer</span><strong>${htmlEscape(report.partyName)}</strong></div>
        <div><span>Period</span><strong>${htmlEscape(period)}</strong></div>
        <div><span>Generated</span><strong>${htmlEscape(report.generatedAt)}</strong></div>
        <div><span>Closing</span><strong>${htmlEscape(report.totals["Balance due"] ?? report.totals.Total)}</strong></div>
      </section>
    `;
  }
  if (blueprint.emphasis === "receipt") {
    const status = receiptPaymentStatus(report);
    return `
      <section class="receipt-confirmation">
        <div>
          <p class="overline">Amount received</p>
          <strong>${htmlEscape(report.totals["Amount paid"] ?? report.totals.Total)}</strong>
          <span>${htmlEscape(blueprint.footerNote)}</span>
        </div>
        <div class="receipt-number">
          <span>Receipt No.</span>
          <strong>${htmlEscape(report.transaction["Reference number"])}</strong>
        </div>
      </section>
      <section class="receipt-status ${status.tone}">
        <strong>${htmlEscape(status.label)}</strong>
        <span>${htmlEscape(status.detail)}</span>
      </section>
      ${introCards(report, "two-column")}
    `;
  }

  if (blueprint.emphasis === "ledger") {
    return `
      <section class="statement-summary">
        <div><span>Opening</span><strong>KES 0.00</strong></div>
        <div><span>Debits / Value</span><strong>${htmlEscape(report.totals.Subtotal)}</strong></div>
        <div><span>Credits / Adjustments</span><strong>${htmlEscape(report.totals.Discount)}</strong></div>
        <div><span>Closing / Balance</span><strong>${htmlEscape(report.totals["Balance due"])}</strong></div>
      </section>
      ${introCards(report, "two-column")}
    `;
  }

  if (blueprint.emphasis === "report") {
    return `
      <section class="report-kpis">
        <div><span>${htmlEscape(blueprint.label)}</span><strong>Ready</strong><small>Generated from posted records and selected filters.</small></div>
        <div><span>Value / Exposure</span><strong>${htmlEscape(report.totals.Total)}</strong><small>Review supporting rows before action.</small></div>
        <div><span>Owner Action</span><strong>Review</strong><small>${htmlEscape(blueprint.footerNote)}</small></div>
      </section>
      <section class="reason-box"><h3>Management Commentary</h3><p>${htmlEscape(blueprint.footerNote)}</p></section>
    `;
  }

  if (blueprint.emphasis === "operations") {
    return introCards(report, template === "purchaseOrder" ? "po-grid" : "grn-grid");
  }

  if (blueprint.emphasis === "control") {
    return `
      ${introCards(report, "two-column")}
      <section class="reason-box"><h3>Control Purpose</h3><p>${htmlEscape(blueprint.footerNote)}</p></section>
    `;
  }

  if (template === "purchaseOrder") return introCards(report, "po-grid");
  return introCards(report, "invoice-grid");
}

function templateOutro(report: Report) {
  const blueprint = blueprintFor(report);
  const template = templateFor(report);
  if (isDayToDayDocument(report) && blueprint.emphasis !== "receipt") {
    const note = template === "grn"
      ? "Goods received as listed above. Differences, rejected quantities or damaged items should be noted before signing."
      : template === "purchaseOrder"
        ? "Please quote this document number on delivery notes and invoices."
        : "Thank you for choosing us. We appreciate your business.";
    return `<section class="terms compact-note"><h3>Note</h3><p>${htmlEscape(note)}</p></section>`;
  }
  if (blueprint.emphasis === "receipt") {
    const status = receiptPaymentStatus(report);
    return `<section class="receipt-slip"><div><strong>Sales Receipt Slip</strong><span>${htmlEscape(report.partyName)}</span></div><div><strong>${htmlEscape(status.label)}</strong><span>${htmlEscape(report.totals["Amount paid"] ?? report.totals.Total)}</span></div></section>`;
  }
  if (template === "purchaseOrder") {
    return `<section class="terms"><h3>Terms and Conditions</h3><ol><li>Quote this purchase order number on delivery notes and invoices.</li><li>Deliver only approved quantities and product specifications.</li><li>Price, tax and delivery variances require written approval.</li></ol></section>`;
  }
  if (blueprint.emphasis === "operations") {
    return `<section class="pod-box"><strong>Proof of Delivery</strong><span>Name, signature, date, condition of goods and delivery exceptions.</span></section>`;
  }
  if (blueprint.emphasis === "ledger" || blueprint.emphasis === "control" || blueprint.emphasis === "report") {
    return `<section class="terms"><h3>Document Note</h3><p>${htmlEscape(blueprint.footerNote)}</p></section>`;
  }
  return "";
}

function htmlDocument(report: Report, print = false) {
  const headers = lineHeaders(report);
  const catalogueDocument = isCustomerPriceListReport(report.moduleName, report.processName);
  const customerSalesStatement = isCustomerSalesStatementReport(report.moduleName, report.processName);
  const plainInvoice = isPlainCustomerInvoice(report);
  const lineRows = report.lines
    .map(
      (line, index) => `<tr>${lineCells(report, line, index)
        .map((cell, cellIndex) => `<td class="${cellIndex >= headers.length - 3 ? "num" : ""}">${htmlEscape(cell)}</td>`)
        .join("")}</tr>`,
    )
    .join("") || `<tr><td colspan="${headers.length}" class="empty-row">No posted records found for the selected filters.</td></tr>`;
  const totalRows = displayTotalEntries(report)
    .map(([label, value], index, all) => `<tr class="${index === all.length - 1 ? "grand" : ""}"><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");
  const approvalRows = Object.entries(report.approvals)
    .map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value)}</dd></div>`)
    .join("");
  const template = templateFor(report);
  const style = blueprintFor(report);
  const dailyDocument = isDayToDayDocument(report);
  const approvalTitle = report.generatedByRole === "owner" ? "Owner Certification and Audit" : "Approval and Audit";
  const signatureLabels = signatureLabelsFor(report);
  const noteTitle = template === "grn" ? "Receiving note" : template === "purchaseOrder" ? "Supplier note" : "Note to customer";
  const noteBody = template === "grn"
    ? "Goods received as listed. Rejected or damaged quantities should be noted before signing."
    : template === "purchaseOrder"
      ? "Please quote this document number on delivery notes and invoices."
      : "Thanks for choosing us. We appreciate your business.";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(report.processName)} - ${htmlEscape(report.businessName)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eaf1f8; color: ${brand.navy}; font-family: Arial, Helvetica, sans-serif; }
    .page { position: relative; max-width: 920px; min-height: 1180px; margin: ${print ? "0" : "24px auto"}; overflow: visible; background: white; padding: 42px 48px 36px; box-shadow: ${print ? "none" : "0 18px 60px rgba(7,26,43,.12)"}; }
    .watermark { position: absolute; inset: 28% auto auto 14%; color: rgba(24,183,201,.06); font-size: 150px; font-weight: 900; letter-spacing: 8px; transform: rotate(-18deg); pointer-events: none; white-space: nowrap; }
    .accent { position: absolute; left: 0; right: 0; top: 0; height: 10px; background: linear-gradient(90deg, var(--doc-accent), ${brand.cyan}, ${brand.gold}); }
    header { position: relative; display: grid; grid-template-columns: 1fr 270px; gap: 32px; align-items: start; }
    .tenant { display: grid; grid-template-columns: 82px 1fr; gap: 16px; align-items: center; }
    .tenant-logo { display: grid; width: 82px; height: 82px; place-items: center; overflow: hidden; border-radius: 14px; border: 1px solid ${brand.border}; background: ${brand.soft}; color: ${brand.blue}; font-size: 24px; font-weight: 800; }
    .tenant-logo img { max-width: 74px; max-height: 74px; object-fit: contain; }
    .tenant h1 { margin: 0 0 5px; font-size: 26px; line-height: 1.1; letter-spacing: 0; }
    .tenant p, .meta p { margin: 2px 0; color: ${brand.slate}; font-size: 12px; line-height: 1.45; }
    .doc-title { text-align: right; }
    .doc-title h2 { margin: 0; color: ${brand.navy}; font-size: 30px; font-weight: 800; letter-spacing: 0; }
    .doc-title .ref { margin-top: 8px; color: ${brand.muted}; font-size: 12px; }
    .solva-mark { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid ${brand.border}; padding: 7px 11px; color: var(--doc-accent); font-size: 12px; font-weight: 800; }
    .solva-mark img { width: 92px; height: 24px; object-fit: contain; }
    .intro { position: relative; margin-top: 34px; }
    .two-column, .grn-grid, .invoice-grid, .po-grid, .daily-document-grid { display: grid; gap: 18px; }
    .two-column, .grn-grid { grid-template-columns: 1fr 1fr; }
    .invoice-grid, .po-grid { grid-template-columns: 1fr 1fr 1fr; }
    .daily-document-grid { grid-template-columns: .9fr .9fr 1.15fr; }
    .daily-document-grid-simple { grid-template-columns: 1fr 1fr; }
    .panel { border: 1px solid ${brand.border}; border-radius: 10px; background: ${brand.soft}; padding: 16px; }
    .box { border: 1px solid ${brand.border}; border-radius: 8px; background: white; padding: 14px; min-height: 116px; }
    .box.dark { background: ${brand.navy}; color: white; }
    .box.dark h3, .box.dark p { color: white; }
    .box h3, .reason-box h3, .terms h3 { margin: 0 0 10px; color: var(--doc-accent); font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    .party { margin: 0 0 6px; font-size: 14px; font-weight: 800; color: ${brand.navy}; }
    .small-note { margin-top: 10px; color: ${brand.muted}; font-size: 11px; line-height: 1.5; }
    .panel h3 { margin: 0 0 10px; color: var(--doc-accent); font-size: 13px; text-transform: uppercase; letter-spacing: .03em; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .meta-card { display: grid; gap: 7px; margin: 0; }
    .meta-card div { display: grid; grid-template-columns: 90px 1fr; gap: 8px; border-bottom: 1px solid ${brand.border}; padding-bottom: 5px; }
    dt { color: ${brand.muted}; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    dd { margin: 2px 0 0; color: ${brand.navy}; font-size: 12px; line-height: 1.35; }
    .receipt-confirmation { display: grid; grid-template-columns: 1fr 220px; gap: 18px; margin-bottom: 18px; border-radius: 10px; background: ${brand.navy}; color: white; padding: 18px; }
    .receipt-confirmation strong { display: block; margin-top: 4px; color: white; font-size: 28px; }
    .receipt-confirmation span, .overline { color: #dbeafe; font-size: 12px; }
    .receipt-number { border-left: 1px solid rgba(255,255,255,.25); padding-left: 18px; }
    .receipt-status { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: -6px 0 18px; border: 2px solid ${brand.border}; border-radius: 10px; background: white; padding: 14px 18px; }
    .receipt-status strong { color: ${brand.navy}; font-size: 30px; font-weight: 900; letter-spacing: .08em; }
    .receipt-status span { color: ${brand.slate}; font-size: 12px; font-weight: 700; }
    .receipt-status.paid { border-color: #10b981; background: #ecfdf5; }
    .receipt-status.paid strong { color: #047857; }
    .receipt-status.partial { border-color: #f59e0b; background: #fffbeb; }
    .receipt-status.partial strong { color: #b45309; }
    .receipt-status.unpaid { border-color: #fb7185; background: #fff1f2; }
    .receipt-status.unpaid strong { color: #be123c; }
    .statement-summary, .report-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    .report-kpis { grid-template-columns: repeat(3, 1fr); }
    .statement-summary div, .report-kpis div { border-radius: 8px; background: var(--doc-soft); padding: 13px; }
    .statement-summary span, .report-kpis span { display: block; color: ${brand.muted}; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .statement-summary strong, .report-kpis strong { display: block; margin-top: 5px; color: ${brand.blue}; font-size: 17px; }
    .compact-statement-summary { margin-bottom: 10px; }
    .compact-statement-summary div { padding: 9px 10px; }
    .compact-statement-summary span { font-size: 9px; }
    .compact-statement-summary strong { font-size: 12px; line-height: 1.25; }
    .report-kpis small { display: block; margin-top: 4px; color: ${brand.slate}; line-height: 1.4; }
    .reason-box, .terms, .pod-box, .receipt-slip, .payment-instructions { margin-top: 18px; border: 1px solid ${brand.border}; border-radius: 8px; background: ${brand.soft}; padding: 14px; }
    .receipt-slip { display: grid; grid-template-columns: 1fr 220px; border-style: dashed; }
    .receipt-slip strong, .receipt-slip span, .pod-box strong, .pod-box span { display: block; }
    .payment-instructions { border-left: 5px solid ${brand.gold}; background: #fffdf5; }
    .payment-instructions h3 { margin: 0 0 8px; color: ${brand.navy}; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    .payment-instructions ul { margin: 0; padding-left: 18px; color: ${brand.navy}; font-size: 12px; line-height: 1.6; }
    .terms ol { margin: 0; padding-left: 18px; color: ${brand.slate}; font-size: 11px; line-height: 1.6; }
    .table-wrap { position: relative; margin-top: 26px; border: 1px solid ${brand.border}; border-radius: 10px; overflow: hidden; }
    .catalogue-document .table-wrap { margin-top: 28px; }
    .catalogue-document .table-wrap caption { background: #f8fafc; color: ${brand.navy}; font-size: 12px; letter-spacing: .04em; }
    .catalogue-document footer { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
    tr, .box, .panel, .receipt-confirmation, .receipt-status, .after-table, .payment-instructions { page-break-inside: avoid; break-inside: avoid; }
    caption { padding: 10px 12px; background: #f8fafc; color: ${brand.slate}; font-size: 11px; font-weight: 800; text-align: left; text-transform: uppercase; }
    th { background: var(--doc-accent); color: white; font-size: 11px; padding: 10px 8px; text-align: left; }
    td, th, dd, p, li { overflow-wrap: anywhere; word-break: normal; }
    td { border-top: 1px solid ${brand.border}; color: ${brand.navy}; font-size: 11px; line-height: 1.35; padding: 10px 8px; vertical-align: top; }
    .empty-row { color: ${brand.muted}; text-align: center; padding: 22px 12px; }
    tbody tr:nth-child(even) td { background: #f4f8fc; }
    .num { text-align: right; }
    .after-table { display: grid; grid-template-columns: 1fr 300px; gap: 28px; margin-top: 24px; align-items: start; }
    .customer-statement-after-table { grid-template-columns: 1fr 240px; gap: 14px; margin-top: 12px; }
    .statement-spacer { min-height: 1px; }
    .totals table { border: 1px solid ${brand.border}; border-radius: 8px; overflow: hidden; }
    .totals th, .totals td { background: white; color: ${brand.navy}; border-top: 1px solid ${brand.border}; font-size: 12px; }
    .totals th { text-align: left; }
    .totals td { text-align: right; font-weight: 700; }
    .totals .grand th, .totals .grand td { background: ${brand.surface}; color: ${brand.blue}; font-size: 14px; }
    .audit ul { margin: 8px 0 0; padding-left: 18px; color: ${brand.slate}; font-size: 11px; line-height: 1.55; }
    .signatures { margin-top: 34px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
    .signature { border-top: 1px solid ${brand.navy}; padding-top: 7px; color: ${brand.slate}; font-size: 11px; text-align: center; }
    .emphasis-receipt .table-wrap { border-width: 2px; border-color: var(--doc-accent); }
    .emphasis-receipt .totals .grand th, .emphasis-receipt .totals .grand td { background: #ecfdf5; color: #0f766e; }
    .emphasis-invoice header { border-bottom: 1px solid ${brand.border}; padding-bottom: 22px; }
    .emphasis-invoice .doc-title h2 { color: var(--doc-accent); }
    .daily-document header { padding-bottom: 14px; }
    .daily-document .tenant { grid-template-columns: 58px 1fr; gap: 12px; }
    .daily-document .tenant-logo { width: 58px; height: 58px; border-radius: 8px; font-size: 18px; }
    .daily-document .tenant-logo img { max-width: 52px; max-height: 52px; }
    .daily-document .tenant h1 { font-size: 22px; margin-bottom: 3px; }
    .daily-document .tenant p, .daily-document .meta p { font-size: 10.5px; line-height: 1.35; }
    .daily-document .doc-title h2 { font-size: 26px; }
    .daily-document .doc-title .ref { margin-top: 5px; font-size: 10.5px; }
    .daily-document .solva-mark { margin-top: 10px; padding: 4px 8px; }
    .daily-document .intro { margin-top: 18px; }
    .daily-document .daily-document-grid { gap: 10px; }
    .daily-document .box { min-height: auto; padding: 10px; }
    .daily-document .box h3 { margin-bottom: 6px; font-size: 10.5px; }
    .daily-document .party { margin-bottom: 2px; font-size: 12px; }
    .daily-document .meta-card { gap: 3px; }
    .daily-document .meta-card div { grid-template-columns: 78px 1fr; gap: 6px; padding-bottom: 2px; }
    .daily-document dt { font-size: 8.8px; }
    .daily-document dd { font-size: 10.5px; }
    .daily-document .table-wrap { margin-top: 14px; border-radius: 6px; }
    .daily-document .table-wrap caption { display: none; }
    .daily-document th { font-size: 9px; padding: 6px 5px; }
    .daily-document td { font-size: 9.2px; line-height: 1.15; padding: 5px; }
    .daily-document .after-table { grid-template-columns: 1fr 240px; gap: 14px; margin-top: 14px; }
    .daily-document .panel, .daily-document .terms, .daily-document .payment-instructions { padding: 10px; }
    .daily-document .signatures { margin-top: 22px; gap: 14px; }
    .emphasis-operations .box { border-left: 5px solid var(--doc-accent); }
    .emphasis-ledger .table-wrap caption { background: #e2e8f0; color: ${brand.navy}; }
    .emphasis-report .page-note { display: block; }
    .emphasis-control .reason-box { border-left: 5px solid var(--doc-accent); }
    footer { margin-top: 36px; border-top: 1px solid ${brand.border}; padding-top: 12px; color: ${brand.muted}; font-size: 10px; line-height: 1.5; text-align: center; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } }
  </style>
</head>
<body>
  <main class="page template-${template} emphasis-${style.emphasis}${dailyDocument ? " daily-document" : ""}${catalogueDocument ? " catalogue-document" : ""}" style="--doc-accent: ${style.accent}; --doc-soft: ${style.soft};">
    <div class="accent"></div>
    <div class="watermark">SOLVA TRADE</div>
    <header>
      <section class="tenant">
        <div class="tenant-logo">${logoHtml(report)}</div>
        <div>
          <h1>${htmlEscape(report.businessName)}</h1>
          <p>${htmlEscape(report.businessLocation)}</p>
          ${
            dailyDocument
              ? `<p>${[
                  report.businessPhone ? `Tel: ${htmlEscape(report.businessPhone)}` : "",
                  report.businessEmail ? `Email: ${htmlEscape(report.businessEmail)}` : "",
                  report.kraPin ? `KRA PIN: ${htmlEscape(report.kraPin)}` : "",
                ].filter(Boolean).join(" | ")}</p>`
              : `${report.businessPhone ? `<p>Phone: ${htmlEscape(report.businessPhone)}</p>` : ""}
          ${report.businessEmail ? `<p>Email: ${htmlEscape(report.businessEmail)}</p>` : ""}
          ${report.kraPin ? `<p>KRA PIN: ${htmlEscape(report.kraPin)}</p>` : ""}`
          }
        </div>
      </section>
      <section class="doc-title">
        <h2>${htmlEscape(titleFor(report))}</h2>
        ${dailyDocument ? "" : `<p class="ref">${htmlEscape(style.label)}</p>`}
        <p class="ref"># ${htmlEscape(report.transaction["Reference number"])}</p>
        ${plainInvoice ? "" : `<p class="ref">Generated ${htmlEscape(report.generatedAt)}</p>`}
        <div class="solva-mark"><img src="/solva-trade-logo.png" alt="Solva Trade" /></div>
      </section>
    </header>

    <section class="intro">${templateIntro(report)}</section>

    <section class="table-wrap">
      <table>
        ${dailyDocument ? "" : `<caption>${htmlEscape(style.table)}</caption>`}
        <thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </section>

    ${
      catalogueDocument
        ? ""
        : `<section class="after-table${customerSalesStatement ? " customer-statement-after-table" : ""}">
      ${
        customerSalesStatement
          ? `<div class="statement-spacer"></div>`
          : dailyDocument
          ? `<article class="panel audit compact-note"><h3>${htmlEscape(noteTitle)}</h3><p>${htmlEscape(noteBody)}</p></article>`
          : `<article class="panel audit">
        <h3>${htmlEscape(approvalTitle)}</h3>
        <dl class="details">${approvalRows}</dl>
        <ul>${report.auditTrail.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </article>`
      }
      <article class="totals">
        <table>${totalRows}</table>
        ${paymentInstructionHtml(report)}
      </article>
    </section>`
    }

    ${catalogueDocument || customerSalesStatement ? "" : `<section class="signatures">
      ${signatureLabels.map((label) => `<div class="signature">${htmlEscape(label)}</div>`).join("")}
    </section>`}

    ${catalogueDocument || customerSalesStatement ? "" : templateOutro(report)}

    ${plainInvoice ? "" : `<footer>
      ${catalogueDocument
        ? htmlEscape(catalogueFooterText(report))
        : `${htmlEscape(report.businessName)} document generated by Solva Trade${dailyDocument || customerSalesStatement ? "" : `. Printed by ${htmlEscape(report.generatedBy)}`} on ${htmlEscape(report.generatedAt)}.`}
    </footer>`}
  </main>
</body>
</html>`;
}

class PdfCanvas {
  private ops: string[] = [];

  rect(x: number, y: number, width: number, height: number, color: string, stroke = false) {
    this.ops.push(`${pdfColors[color]} ${stroke ? "RG" : "rg"} ${x} ${y} ${width} ${height} re ${stroke ? "S" : "f"}`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "border", width = 1) {
    this.ops.push(`${pdfColors[color]} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  text(value: string | number | null | undefined, x: number, y: number, size = 10, color = "navy", bold = false) {
    this.ops.push(`BT ${pdfColors[color]} rg ${bold ? "/F2" : "/F1"} ${size} Tf ${x} ${y} Td (${pdfText(String(value ?? ""))}) Tj ET`);
  }

  image(name: string, x: number, y: number, width: number, height: number) {
    this.ops.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q`);
  }

  fitText(value: string, x: number, y: number, width: number, size = 10, color = "navy", bold = false, minSize = 6) {
    const normalized = String(value ?? "-");
    const estimatedWidth = normalized.length * size * 0.52;
    const fittedSize = estimatedWidth > width ? Math.max(minSize, Math.floor((width / Math.max(1, normalized.length * 0.52)) * 10) / 10) : size;
    const maxChars = Math.max(4, Math.floor(width / (fittedSize * 0.52)));
    const text = normalized.length > maxChars ? `${normalized.slice(0, Math.max(1, maxChars - 3))}...` : normalized;
    this.text(text, x, y, fittedSize, color, bold);
  }

  wrap(value: string, x: number, y: number, width: number, size = 10, color = "navy", bold = false, leading = size + 4, maxLines = 5) {
    const maxChars = Math.max(8, Math.floor(width / (size * 0.52)));
    const words = splitForPdfCell(value, maxChars);
    const rows: string[] = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        rows.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) rows.push(current);
    const visibleRows = rows.slice(0, maxLines);
    if (rows.length > maxLines && visibleRows.length) {
      const last = visibleRows[visibleRows.length - 1];
      visibleRows[visibleRows.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(1, maxChars - 3))}...` : "...";
    }
    visibleRows.forEach((row, index) => this.text(row, x, y - index * leading, size, color, bold));
    return y - Math.min(rows.length, maxLines) * leading;
  }

  output() {
    return this.ops.join("\n");
  }
}

function pdfTableWidths(report: Report, headers: string[]) {
  if (isCustomerFacingInvoice(report)) return [34, 244, 52, 76, 56, 68];
  if (isCustomerSalesStatementReport(report.moduleName, report.processName)) return customerSalesStatementWidths(headers, 530);
  if (report.processName === "Customer Price List") return [30, 190, 86, 92, 94, 68];
  if (report.processName === "Product Master Report") return [76, 154, 62, 58, 58, 72, 50];
  if (report.processName === "Product Inventory Usage Report") return [72, 154, 56, 58, 70, 54, 66];
  if (report.processName === "Inventory Aging Report") return [72, 150, 70, 58, 72, 48, 60];
  if (report.processName === "Inventory Audit Report") return [70, 144, 80, 66, 58, 72, 40];
  if (report.processName === "Inventory Discrepancy Report") return [72, 144, 62, 68, 76, 56, 52];
  if (report.processName === "Inventory Damage Report") return [74, 142, 64, 88, 44, 58, 60];
  if (report.processName === "Sales Tracking Report") return [146, 64, 64, 58, 72, 62, 64];
  return headers.length === 7
    ? [72, 148, 66, 66, 60, 68, 50]
    : headers.length === 8
      ? [46, 126, 58, 58, 62, 62, 62, 56]
      : headers.length === 6
        ? [62, 172, 70, 72, 72, 82]
        : headers.length === 5
          ? [156, 58, 92, 78, 146]
          : [62, 220, 44, 76, 58, 70];
}

function renderPdfTable(canvas: PdfCanvas, report: Report, startY: number) {
  const allHeaders = lineHeaders(report);
  const compactReportHeaders: Record<string, string[]> = {
    "Customer Price List": ["#", "Product", "SKU", "Customer price", "VAT treatment", "Available quantity"],
    "Product Master Report": ["Item no.", "Item name", "Brand", "Category", "Stock quantity", "Total value", "Reorder status"],
    "Product Inventory Usage Report": ["Item no.", "Item name", "Qty in stock", "Reorder level", "Qty above / below par", "Order qty", "Total order"],
    "Inventory Aging Report": ["Item no.", "Item name", "Age bucket", "Qty in stock", "Inventory value", "Risk level", "Recommended action"],
    "Inventory Audit Report": ["Item no.", "Item name", "Stock location", "Cost per item", "Stock quantity", "Total value", "VAT treatment"],
    "Inventory Discrepancy Report": ["Item no.", "Item name", "On-hand quantity", "Actual item count", "Inventory discrepancy (auto-fill)", "Reorder level", "Item discontinued?"],
    "Inventory Damage Report": ["Item no.", "Name", "Condition", "Damage report", "Quantity", "Asset value", "Total value"],
    "Sales Tracking Report": ["Product name", "Cost per item", "Markup percentage", "Total sold", "Total revenue", "Profit per item", "Total income"],
    "KRA ETR Sales Report": ["Sr. No", "Customer KRA PIN", "Customer Name", "KRA Device No.", "Invoice Date", "CUI Invoice No.", "Item Description", "Exclusive Amount", "VAT", "Inclusive Amount"],
  };
  const pdfPreferredHeaders = compactReportHeaders[report.processName] ?? [
    "Item no.",
    "Item name",
    "Name",
    "Customer",
    "Vendor",
    "Period",
    "Revenue (KES)",
    "Stock quantity",
    "Total value",
    "Status",
    "Notes",
  ];
  const preferredHeaders = pdfPreferredHeaders.filter((header) => allHeaders.includes(header));
  const headers = allHeaders.length > 7 ? (preferredHeaders.length >= 4 ? preferredHeaders.slice(0, 7) : allHeaders.slice(0, 7)) : allHeaders;
  const rows = report.lines.map((line, index) => headers.map((header) => valueForHeader(report, line, index, header)));
  const x = 48;
  const widths = pdfTableWidths(report, headers);
  let y = startY;

  canvas.rect(x, y - 22, 530, 26, "navy");
  let cursor = x;
  headers.forEach((header, index) => {
    canvas.wrap(header, cursor + 5, y - 8, (widths[index] ?? 70) - 10, 7, "white", true, 8);
    cursor += widths[index] ?? 70;
  });
  y -= 30;

  if (rows.length === 0) {
    canvas.rect(x, y - 32, 530, 38, "soft");
    canvas.text("No posted records found for the selected filters.", x + 150, y - 10, 8.5, "muted");
    return y - 48;
  }

  let renderedRows = 0;
  for (const [rowIndex, row] of rows.entries()) {
    const compactDaily = isDayToDayDocument(report);
    const maxLinesForCell = (index: number) => compactDaily ? (index === 1 ? 2 : 1) : 4;
    const rowFontSize = compactDaily ? 7.4 : 10;
    const lineHeight = compactDaily ? 6.2 : 7;
    const cellLines = row.map((cell, index) => wrapLineCount(cell, (widths[index] ?? 70) - 10, lineHeight, maxLinesForCell(index)));
    const height = compactDaily ? Math.max(18, Math.max(...cellLines) * 7 + 9) : Math.max(32, Math.max(...cellLines) * 10 + 16);
    if (y - height < (compactDaily ? 210 : 260)) break;
    canvas.rect(x, y - height + 6, 530, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 6, x + 530, y + 6);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell || "-", cursor + 5, y - 6, (widths[index] ?? 70) - 10, lineHeight, "navy", false, rowFontSize, maxLinesForCell(index));
      cursor += widths[index] ?? 70;
    });
    y -= height;
    renderedRows += 1;
  }

  canvas.line(x, y + 6, x + 530, y + 6, "border");
  return y - 16;
}

function isLandscapePdfReport(report: Report) {
  const template = templateFor(report);
  const longListDocument =
    isCustomerPriceListReport(report.moduleName, report.processName) ||
    isCustomerSalesStatementReport(report.moduleName, report.processName);
  const lineHeavyOperationalDocument =
    report.lines.length > 12 &&
    ["grn", "purchaseOrder", "deliveryNote", "dispatchNote", "creditNote", "debitNote", "statement"].includes(template);

  return ["report", "inventoryReport", "stockMovement", "executiveReport"].includes(template) || longListDocument || lineHeavyOperationalDocument;
}

function pdfDocument(content: string, width: number, height: number, images: PdfImageResource[] = []) {
  return pdfDocumentPages([content], width, height, images);
}

function pdfDocumentPages(contents: string[], width: number, height: number, images: PdfImageResource[] = []) {
  const pageCount = Math.max(1, contents.length);
  const fontRegularObject = 3;
  const fontBoldObject = 4;
  const imageStartObject = 5;
  const pageStartObject = imageStartObject + images.length;
  const contentStartObject = pageStartObject + pageCount;
  const xobjectResources = images.length
    ? ` /XObject << ${images.map((image, index) => `/${image.name} ${imageStartObject + index} 0 R`).join(" ")} >>`
    : "";
  const imageObjects = images.map((image) =>
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`,
        "utf8",
      ),
      image.data,
      Buffer.from("\nendstream", "utf8"),
    ]),
  );
  const pageObjects = contents.map((_, index) => {
    const contentObject = contentStartObject + index;
    return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >>${xobjectResources} >> /Contents ${contentObject} 0 R >>`;
  });
  const contentObjects = contents.map((content) => {
    const contentBuffer = Buffer.from(content, "utf8");
    return Buffer.concat([Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, "utf8"), contentBuffer, Buffer.from("\nendstream", "utf8")]);
  });
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${contents.map((_, index) => `${pageStartObject + index} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...imageObjects,
    ...pageObjects,
    ...contentObjects,
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];
  let offset = chunks[0].length;

  objects.forEach((object, index) => {
    const header = Buffer.from(`${index + 1} 0 obj\n`, "utf8");
    const body = typeof object === "string" ? Buffer.from(object, "utf8") : object;
    const footer = Buffer.from("\nendobj\n", "utf8");
    offsets.push(offset);
    chunks.push(header, body, footer);
    offset += header.length + body.length + footer.length;
  });

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((objectOffset) => `${String(objectOffset).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    "%%EOF",
  ].join("\n");
  chunks.push(Buffer.from(xref, "utf8"));
  return Buffer.concat(chunks);
}

function wideReportHeaders(report: Report) {
  const allHeaders = lineHeaders(report);
  const preferred: Record<string, string[]> = {
    "Customer Price List": ["#", "Product", "SKU", "Customer price", "VAT treatment", "Available quantity"],
    "Product Master Report": ["Item no.", "Item name", "Brand", "Category", "Vendor", "Stock quantity", "Cost per item", "Selling price", "Total value", "Reorder status"],
    "Product Inventory Usage Report": ["Item no.", "Item name", "Vendor", "Qty in stock", "Reorder level", "Qty above / below par", "Order qty", "Total order", "Reorder required (auto-fill)"],
    "Inventory Aging Report": ["Item no.", "Item name", "Brand", "Category", "Last received", "Age bucket", "Qty in stock", "Inventory value", "Risk level", "Recommended action"],
    "Inventory Audit Report": ["Item no.", "Item name", "Vendor", "Stock location", "Cost per item", "Stock quantity", "Total value", "Reorder level", "VAT treatment", "Tracking"],
    "Inventory Discrepancy Report": ["Item no.", "Item name", "Vendor", "On-hand quantity", "Actual item count", "Inventory discrepancy (auto-fill)", "Reorder level", "Item discontinued?"],
    "Inventory Damage Report": ["Item no.", "Name", "Vendor", "Condition", "Damage report", "Quantity", "Asset value", "Total value"],
    "Sales Tracking Report": ["Product name", "Cost per item", "Markup percentage", "Total sold", "Total revenue", "Profit per item", "Total income"],
    "Customer Sales and Profit Report": ["#", "Date", "Invoice no.", "Product", "SKU", "Qty", "Rate", "Amount", "Payment status", "Balance due"],
    "Customer Sales Statement": ["#", "Date", "Document No.", "Type", "Description", "Debit", "Credit", "Balance"],
    "Profit by Supplier and Source Report": ["#", "Source", "Supplier", "Period", "Products", "Units sold", "Sales", "Supply cost", "Gross profit", "Margin"],
    "KRA ETR Sales Report": ["Sr. No", "Customer KRA PIN", "Customer Name", "KRA Device No.", "Invoice Date", "CUI Invoice No.", "Item Description", "Exclusive Amount", "VAT", "Inclusive Amount"],
  };
  const requested = preferred[report.processName] ?? ["Period", "Item no.", "Item name", "Name", "Customer", "Vendor", "Revenue (KES)", "Stock quantity", "Total value", "Status", "Notes"];
  const selected = requested.filter((header) => allHeaders.includes(header));
  return selected.length >= 5 ? selected : allHeaders.slice(0, Math.min(10, allHeaders.length));
}

function scaledWidths(weights: number[], totalWidth = 746) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  let used = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return totalWidth - used;
    const width = Math.max(24, Math.floor((weight / total) * totalWidth));
    used += width;
    return width;
  });
}

function customerSalesStatementWidths(headers: string[], totalWidth = 746) {
  const fixedWidths: number[] = headers.map((header) => {
    const h = header.toLowerCase();
    if (h === "#" || h === "sr. no" || h.includes("serial")) return totalWidth > 600 ? 28 : 24;
    if (h === "date" || h.includes("invoice date")) return totalWidth > 600 ? 58 : 48;
    if (h.includes("document no")) return totalWidth > 600 ? 86 : 70;
    if (h === "type") return totalWidth > 600 ? 52 : 44;
    if (h.includes("invoice")) return totalWidth > 600 ? 78 : 64;
    if (h === "qty" || h.includes("quantity")) return totalWidth > 600 ? 38 : 32;
    if (h === "rate") return totalWidth > 600 ? 78 : 62;
    if (h.includes("debit") || h.includes("credit") || h.includes("amount") || h.includes("balance")) return totalWidth > 600 ? 84 : 68;
    if (h.includes("status")) return totalWidth > 600 ? 70 : 56;
    return 0;
  });
  const flexibleWeights: number[] = headers.map((header) => {
    const h = header.toLowerCase();
    if (h.includes("description")) return 1.6;
    if (h.includes("product")) return 1.28;
    if (h === "sku" || h.includes("sku")) return 1;
    return 0;
  });
  const fixedTotal = fixedWidths.reduce((sum, width) => sum + width, 0);
  const flexibleTotal = flexibleWeights.reduce((sum, weight) => sum + weight, 0);
  const remaining = Math.max(0, totalWidth - fixedTotal);
  let used = 0;

  return headers.map((_, index) => {
    const fixed = fixedWidths[index];
    if (fixed) {
      used += fixed;
      return fixed;
    }
    const weight = flexibleWeights[index] || 1;
    const width =
      index === headers.length - 1
        ? totalWidth - used
        : Math.max(totalWidth > 600 ? 54 : 42, Math.floor((weight / Math.max(1, flexibleTotal || headers.length)) * remaining));
    used += width;
    return width;
  });
}

function wideTableWidths(headers: string[], report?: Report) {
  if (report && isCustomerSalesStatementReport(report.moduleName, report.processName)) {
    return customerSalesStatementWidths(headers, 746);
  }

  const weights = headers.map((header) => {
    const h = header.toLowerCase();
    if (h === "#" || h === "sr. no" || h.includes("serial")) return 0.45;
    if (h === "date" || h.includes("invoice date")) return 0.85;
    if (h.includes("invoice no") || h.includes("reference") || h.includes("receipt no")) return 1.05;
    if (h === "sku" || h.includes("sku")) return 1.85;
    if (h.includes("name") || h.includes("description") || h.includes("product")) return 2.35;
    if (h.includes("vendor") || h.includes("customer") || h.includes("action") || h.includes("tracking")) return 1.55;
    if (h.includes("value") || h.includes("price") || h.includes("cost") || h.includes("revenue") || h.includes("profit") || h.includes("total")) return 1.15;
    if (h.includes("qty") || h.includes("quantity")) return 0.65;
    if (h.includes("level") || h.includes("stock")) return 1.05;
    if (h.includes("status") || h.includes("risk") || h.includes("vat")) return 1.05;
    return 1;
  });
  return scaledWidths(weights);
}

function renderLandscapePdfTable(canvas: PdfCanvas, report: Report, startY: number) {
  const headers = wideReportHeaders(report);
  const rows = report.lines.map((line, index) => headers.map((header) => valueForHeader(report, line, index, header)));
  const widths = wideTableWidths(headers, report);
  const x = 48;
  let y = startY;

  canvas.rect(x, y - 18, 746, 24, "navy");
  let cursor = x;
  headers.forEach((header, index) => {
    canvas.wrap(header, cursor + 5, y - 4, widths[index] - 10, 7, "white", true, 8);
    cursor += widths[index];
  });
  y -= 28;

  if (!rows.length) {
    canvas.rect(x, y - 34, 746, 40, "soft");
    canvas.text("No posted records found for this report yet.", x + 284, y - 12, 8, "muted");
    return y - 48;
  }

  let renderedRows = 0;
  for (const [rowIndex, row] of rows.entries()) {
    const cellLines = row.map((cell, index) => wrapLineCount(cell, widths[index] - 10, 6.6, 4));
    const height = Math.max(30, Math.max(...cellLines) * 9 + 15);
    if (y - height < 118) break;
    canvas.rect(x, y - height + 5, 746, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell || "-", cursor + 5, y - 7, widths[index] - 10, 6.6, "navy", false, 9, 4);
      cursor += widths[index];
    });
    y -= height;
    renderedRows += 1;
  }

  canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
  return y - 12;
}

function renderLandscapePdfTablePage(
  canvas: PdfCanvas,
  headers: string[],
  widths: number[],
  rows: string[][],
  startRow: number,
  startY: number,
  bottomY = 70,
) {
  const x = 48;
  let y = startY;
  let cursor = x;

  canvas.rect(x, y - 18, 746, 24, "navy");
  headers.forEach((header, index) => {
    canvas.wrap(header, cursor + 5, y - 4, widths[index] - 10, 7, "white", true, 8);
    cursor += widths[index];
  });
  y -= 28;

  if (!rows.length) {
    canvas.rect(x, y - 34, 746, 40, "soft");
    canvas.text("No posted records found for this report yet.", x + 284, y - 12, 8, "muted");
    return { nextRow: rows.length, y: y - 48 };
  }

  let rowIndex = startRow;
  while (rowIndex < rows.length) {
    const row = rows[rowIndex];
    const cellLines = row.map((cell, index) => wrapLineCount(cell, widths[index] - 10, 6.4, 4));
    const height = Math.max(26, Math.max(...cellLines) * 8.5 + 13);
    if (y - height < bottomY) break;
    canvas.rect(x, y - height + 5, 746, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell || "-", cursor + 5, y - 7, widths[index] - 10, 6.4, "navy", false, 8.2, 4);
      cursor += widths[index];
    });
    y -= height;
    rowIndex += 1;
  }

  canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
  return { nextRow: rowIndex, y: y - 12 };
}

function profitLossAmount(line: ReportLine) {
  return detailAmount(line.details?.Amount ?? money(line.lineTotal));
}

function profitLossRows(report: Report) {
  const rows = report.lines.filter((line) => line.sku !== "LEDGER");
  const revenue = rows.filter((line) => {
    const section = `${line.details?.Section ?? line.batch} ${line.details?.Class ?? line.taxRate}`.toLowerCase();
    return section.includes("revenue") || section.includes("income");
  });
  const cost = rows.filter((line) => {
    const section = `${line.details?.Section ?? line.batch} ${line.details?.Class ?? line.taxRate}`.toLowerCase();
    return section.includes("cost");
  });
  const expenses = rows.filter((line) => {
    const section = `${line.details?.Section ?? line.batch} ${line.details?.Class ?? line.taxRate}`.toLowerCase();
    return section.includes("expense");
  });
  const summaries = rows.filter((line) => line.sku === "TOTAL");
  const otherIncomeKeywords = ["commission", "rent", "interest", "discount", "dividend", "royalty", "premium", "bad debts recovered", "miscellaneous", "sundry"];
  const otherIncome = revenue.filter((line) => {
    const label = `${line.description} ${line.details?.Section ?? ""}`.toLowerCase();
    return otherIncomeKeywords.some((keyword) => label.includes(keyword));
  });
  const tradingIncome = revenue.filter((line) => !otherIncome.includes(line));
  const totalRevenue = tradingIncome.reduce((sum, line) => sum + profitLossAmount(line), 0);
  const totalOtherIncome = otherIncome.reduce((sum, line) => sum + Math.abs(profitLossAmount(line)), 0);
  const totalCost = cost.reduce((sum, line) => sum + Math.abs(profitLossAmount(line)), 0);
  const totalExpenses = expenses.reduce((sum, line) => sum + Math.abs(profitLossAmount(line)), 0);
  const grossProfit = totalRevenue - totalCost;
  const netProfit = grossProfit + totalOtherIncome - totalExpenses;
  const left = [
    ...(grossProfit < 0 ? [{ label: "Gross Loss (transferred from trading account)", amount: Math.abs(grossProfit), bold: true, section: "Trading result" }] : []),
    { label: "Office, Administration and Operating Expenses", amount: null, bold: true, section: "header" },
    ...expenses.map((line) => ({ label: line.description, amount: Math.abs(profitLossAmount(line)), bold: false, section: line.details?.Section ?? "Expenses" })),
    ...(netProfit > 0 ? [{ label: "Net Profit transferred to capital", amount: netProfit, bold: true, section: "Net result" }] : []),
  ];
  const right = [
    ...(grossProfit >= 0 ? [{ label: "Gross Profit (transferred from trading account)", amount: grossProfit, bold: true, section: "Trading result" }] : []),
    ...otherIncome.map((line) => ({ label: line.description, amount: Math.abs(profitLossAmount(line)), bold: false, section: line.details?.Section ?? "Income" })),
    ...summaries
      .filter((line) => {
        const label = line.description.toLowerCase();
        return !label.includes("total revenue") && !label.includes("gross profit") && !label.includes("cost of sales") && !label.includes("operating expenses") && !label.includes("net profit") && !label.includes("net loss");
      })
      .map((line) => ({ label: line.description, amount: Math.abs(profitLossAmount(line)), bold: false, section: line.details?.Section ?? "Other income" })),
    ...(netProfit < 0 ? [{ label: "Net Loss transferred to capital", amount: Math.abs(netProfit), bold: true, section: "Net result" }] : []),
  ];
  return { left, right, totalRevenue, totalCost, totalExpenses, totalOtherIncome, grossProfit, netProfit };
}

function drawProfitLossSide(
  canvas: PdfCanvas,
  rows: Array<{ label: string; amount: number | null; bold: boolean; section: string }>,
  x: number,
  y: number,
  width: number,
  maxRows: number,
) {
  let cursorY = y;
  rows.slice(0, maxRows).forEach((row, index) => {
    if (row.amount === null) {
      canvas.text(row.label, x, cursorY, 8.2, "blue", true);
      cursorY -= 13;
      return;
    }
    if (index % 2 === 0) canvas.rect(x - 4, cursorY - 4, width + 8, 12, "surface");
    canvas.wrap(row.label, x, cursorY, width - 92, row.bold ? 7.8 : 7.3, row.bold ? "navy" : "slate", row.bold, 8.5, 1);
    canvas.fitText(money(row.amount), x + width - 86, cursorY, 82, 7.4, row.bold ? "navy" : "slate", true, 5.8);
    cursorY -= 13;
  });
  if (rows.length > maxRows) {
    canvas.text(`+ ${rows.length - maxRows} more lines in Excel/CSV export`, x, cursorY, 7, "blue", true);
    cursorY -= 12;
  }
  return cursorY;
}

function isMonthlyProfitLossReport(report: Report) {
  return report.lines.some((line) => line.details?.["Statement type"] === "Monthly profit and loss");
}

async function monthlyProfitAndLossPdf(report: Report) {
  const assets = await pdfAssets(report, "landscape");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const rows = report.lines.filter((line) => line.details?.["Statement type"] === "Monthly profit and loss");
  const totalSales = rows.reduce((sum, line) => sum + detailAmount(line.details?.Sales), 0);
  const totalCost = rows.reduce((sum, line) => sum + detailAmount(line.details?.["Cost of goods sold"]), 0);
  const totalExpenses = rows.reduce((sum, line) => sum + detailAmount(line.details?.["Operating expenses"]), 0);
  const totalGross = totalSales - totalCost;
  const totalNet = totalGross - totalExpenses;
  const startMonth = rows[0]?.details?.Month ?? "Opening month";
  const endMonth = rows.at(-1)?.details?.Month ?? "Current month";
  const rowsPerPage = 18;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const widths = [120, 118, 128, 118, 128, 118, 74];
  const headers = ["Month", "Sales", "Cost of goods", "Gross profit", "Expenses", "Net profit/loss", "Margin"];
  const kpis = [
    ["Sales", totalSales, "blue"],
    ["Cost of goods sold", totalCost, "slate"],
    ["Gross profit", totalGross, totalGross >= 0 ? "blue" : "gold"],
    ["Expenses", totalExpenses, "slate"],
    [totalNet >= 0 ? "Net profit" : "Net loss", totalNet, totalNet >= 0 ? "blue" : "gold"],
  ] as const;

  const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
    const canvas = new PdfCanvas();
    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    canvas.rect(0, 0, 842, 595, "white");
    canvas.rect(0, 586, 280, 9, "blue");
    canvas.rect(280, 586, 280, 9, "cyan");
    canvas.rect(560, 586, 282, 9, "gold");
    canvas.text("SOLVA TRADE", 214, 302, 54, "watermark", true);
    canvas.text("Monthly Profit and Loss", 298, 282, 13, "watermark");

    canvas.rect(48, 516, 50, 46, "surface");
    if (!drawFittedImage(canvas, tenantLogo, 52, 520, 42, 38)) canvas.text(initials(report.businessName), 60, 534, 16, "blue", true);
    canvas.text(report.businessName, 112, 548, 17, "navy", true);
    canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 112, 529, 332, 7.8, "slate");
    canvas.text("PROFIT AND LOSS ACCOUNT", 468, 548, 16, "navy", true);
    canvas.text(`${startMonth} to ${endMonth}`, 468, 532, 8.2, "slate");
    canvas.text(`Generated: ${report.generatedAt}`, 468, 518, 7.6, "muted");
    if (!drawFittedImage(canvas, solvaLogo, 704, 522, 82, 22)) {
      canvas.text("SOLVA", 704, 532, 11, "blue", true);
      canvas.text("TRADE", 748, 532, 8, "cyan", true);
    }

    kpis.forEach(([label, value, tone], index) => {
      const x = 48 + index * 151;
      canvas.rect(x, 470, 136, 32, "surface");
      canvas.text(label.toUpperCase(), x + 9, 490, 6.1, "muted", true);
      canvas.fitText(money(value), x + 9, 476, 114, 9.2, tone, true, 5.8);
    });

    const tableX = 48;
    let y = 440;
    canvas.rect(tableX, y - 22, 746, 24, "navy");
    let headerX = tableX;
    headers.forEach((header, index) => {
      canvas.wrap(header, headerX + 6, y - 8, widths[index] - 10, 7.1, "white", true, 8, 1);
      headerX += widths[index];
    });
    y -= 32;

    pageRows.forEach((line, rowIndex) => {
      const gross = detailAmount(line.details?.["Gross profit"]);
      const net = detailAmount(line.details?.["Net profit / loss"]);
      if (rowIndex % 2 === 0) canvas.rect(tableX, y - 14, 746, 22, "soft");
      const values = [
        line.details?.Month ?? line.description,
        line.details?.Sales ?? money(line.unitPrice),
        line.details?.["Cost of goods sold"] ?? money(line.discount),
        money(gross),
        line.details?.["Operating expenses"] ?? money(line.taxAmount),
        money(net),
        line.details?.["Net margin"] ?? line.taxRate,
      ];
      let cellX = tableX;
      values.forEach((value, cellIndex) => {
        const tone = cellIndex === 5 && net < 0 ? "gold" : cellIndex === 3 && gross < 0 ? "gold" : "slate";
        canvas.fitText(value, cellX + 6, y, widths[cellIndex] - 12, 7.4, tone, cellIndex > 0, 5.8);
        cellX += widths[cellIndex];
      });
      y -= 22;
    });

    if (pageIndex === pageCount - 1) {
      canvas.line(tableX, y + 4, 794, y + 4, "navy", 0.8);
      const totals = ["Total", money(totalSales), money(totalCost), money(totalGross), money(totalExpenses), money(totalNet), totalSales ? `${((totalNet / totalSales) * 100).toFixed(1)}%` : "0.0%"];
      let totalX = tableX;
      totals.forEach((value, index) => {
        canvas.fitText(value, totalX + 6, y - 10, widths[index] - 12, 8, index === 0 || index === 5 ? "navy" : "slate", true, 5.8);
        totalX += widths[index];
      });
    }

    canvas.line(48, 66, 794, 66, "border", 0.5);
    canvas.text(`${report.businessName} | Monthly Profit and Loss Account`, 48, 48, 7.2, "muted");
    canvas.text("Sales are posted invoices. Cost of goods sold comes from received-stock allocation costs. Expenses come from recorded office expenses.", 286, 48, 7.2, "muted");
    canvas.text(`Page ${pageIndex + 1} of ${pageCount}`, 740, 48, 7.2, "muted");
    return canvas.output();
  });

  return pdfDocumentPages(pages, 842, 595, assets);
}

async function profitAndLossPdf(report: Report) {
  if (isMonthlyProfitLossReport(report)) return monthlyProfitAndLossPdf(report);

  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "landscape");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const pl = profitLossRows(report);
  const leftTotal = (pl.grossProfit < 0 ? Math.abs(pl.grossProfit) : 0) + pl.totalExpenses + Math.max(pl.netProfit, 0);
  const rightTotal = (pl.grossProfit >= 0 ? pl.grossProfit : 0) + pl.totalOtherIncome + Math.max(-pl.netProfit, 0);
  const closingTotal = Math.max(leftTotal, rightTotal, 0);

  canvas.rect(0, 0, 842, 595, "white");
  canvas.rect(0, 586, 280, 9, "blue");
  canvas.rect(280, 586, 280, 9, "cyan");
  canvas.rect(560, 586, 282, 9, "gold");
  canvas.text("SOLVA TRADE", 214, 302, 54, "watermark", true);
  canvas.text("Profit and Loss Account", 310, 282, 13, "watermark");

  canvas.rect(48, 508, 54, 50, "surface");
  if (!drawFittedImage(canvas, tenantLogo, 52, 512, 46, 42)) canvas.text(initials(report.businessName), 61, 528, 17, "blue", true);
  canvas.text(report.businessName, 118, 546, 17, "navy", true);
  canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 118, 526, 330, 8, "slate");
  canvas.text("PROFIT AND LOSS ACCOUNT", 304, 548, 17, "navy", true);
  canvas.text(`For the period ended ${report.transaction["Document date"]}`, 326, 532, 8.2, "slate");
  canvas.text(`Generated: ${report.generatedAt}`, 344, 518, 7.6, "muted");
  canvas.rect(700, 520, 94, 28, "navy");
  if (!drawFittedImage(canvas, solvaLogo, 704, 523, 86, 22)) {
    canvas.text("SOLVA", 714, 532, 12, "white", true);
    canvas.text("TRADE", 760, 532, 9, "cyan", true);
  }

  const resultTone = pl.netProfit >= 0 ? "blue" : "gold";
  const kpis = [
    ["Gross profit / loss", money(pl.grossProfit)],
    ["Operating expenses", money(pl.totalExpenses)],
    [pl.netProfit >= 0 ? "Net profit" : "Net loss", money(pl.netProfit)],
  ];
  kpis.forEach(([label, value], index) => {
    const x = 48 + index * 250;
    canvas.rect(x, 462, 226, 34, "surface");
    canvas.text(label.toUpperCase(), x + 12, 482, 6.8, "muted", true);
    canvas.fitText(value, x + 12, 468, 126, 11, index === 2 ? resultTone : "blue", true, 7);
  });

  canvas.rect(48, 94, 746, 350, "white", true);
  canvas.rect(48, 418, 746, 26, "navy");
  canvas.text("DR - EXPENSES, LOSSES AND NET PROFIT", 62, 428, 8.6, "white", true);
  canvas.text("KES", 360, 428, 8.6, "white", true);
  canvas.text("CR - INCOME, GAINS AND NET LOSS", 434, 428, 8.6, "white", true);
  canvas.text("KES", 746, 428, 8.6, "white", true);
  canvas.line(421, 94, 421, 444, "border", 0.8);

  drawProfitLossSide(canvas, pl.left, 62, 402, 336, 22);
  drawProfitLossSide(canvas, pl.right, 434, 402, 336, 22);
  canvas.line(62, 122, 398, 122, "navy", 0.8);
  canvas.line(434, 122, 770, 122, "navy", 0.8);
  canvas.text("Total", 62, 108, 8.5, "navy", true);
  canvas.fitText(money(closingTotal), 312, 108, 86, 8.5, "navy", true, 6);
  canvas.text("Total", 434, 108, 8.5, "navy", true);
  canvas.fitText(money(closingTotal), 684, 108, 86, 8.5, "navy", true, 6);

  canvas.line(48, 72, 794, 72, "border", 0.5);
  canvas.text(`${report.businessName} | Profit and Loss Account`, 48, 54, 7.2, "muted");
  canvas.text(`Generated by Solva Trade on ${report.generatedAt}. ${blueprintFor(report).footerNote}`, 254, 54, 7.2, "muted");
  canvas.text("Page 1 of 1", 746, 54, 7.2, "muted");
  return pdfDocument(canvas.output(), 842, 595, assets);
}

function plainAmount(value: number) {
  const absolute = Math.abs(value);
  const formatted = absolute.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `(${formatted})` : formatted;
}

function statementAmount(line: ReportLine) {
  return detailAmount(line.details?.Closing ?? line.details?.Amount ?? money(line.lineTotal));
}

async function trialBalancePdf(report: Report) {
  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "portrait");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const rows = report.lines.filter((line) => line.sku !== "LEDGER" && line.sku !== "TOTAL");
  const mapped = rows.map((line) => {
    const debit = detailAmount(line.details?.["Closing Debit"] ?? line.details?.Debit ?? "");
    const credit = detailAmount(line.details?.["Closing Credit"] ?? line.details?.Credit ?? "");
    return {
      account: line.description,
      ledgerFolio: line.sku || "-",
      debit,
      credit,
    };
  });
  const debitTotal = mapped.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = mapped.reduce((sum, row) => sum + row.credit, 0);

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 832, 612, 10, "blue");
  canvas.rect(204, 832, 204, 10, "cyan");
  canvas.rect(408, 832, 204, 10, "gold");
  canvas.text("SOLVA TRADE", 88, 430, 68, "watermark", true);
  canvas.rect(48, 748, 54, 50, "surface");
  if (!drawFittedImage(canvas, tenantLogo, 52, 752, 46, 42)) canvas.text(initials(report.businessName), 61, 768, 17, "blue", true);
  canvas.text(report.businessName, 118, 786, 17, "navy", true);
  canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 118, 766, 260, 8, "slate");
  canvas.rect(432, 762, 104, 28, "navy");
  if (!drawFittedImage(canvas, solvaLogo, 438, 766, 92, 20)) canvas.text("SOLVA TRADE", 448, 772, 10, "white", true);

  canvas.text(report.businessName, 238, 726, 13, "navy", true);
  canvas.text("TRIAL BALANCE", 250, 708, 16, "navy", true);
  canvas.text(`As on ${report.transaction["Document date"]}`, 246, 692, 9, "slate");

  const x = 48;
  let y = 652;
  const widths = [260, 48, 118, 118];
  const headers = ["Particulars", "L.F.", "Dr. Balance (KES)", "Cr. Balance (KES)"];
  canvas.rect(x, y, 544, 28, "surface", true);
  let cursor = x;
  headers.forEach((header, index) => {
    canvas.text(header, cursor + 8, y + 10, 8.8, "navy", true);
    if (index > 0) canvas.line(cursor, y, cursor, y + 28, "border", 0.5);
    cursor += widths[index];
  });
  y -= 26;
  mapped.slice(0, 24).forEach((row, index) => {
    canvas.rect(x, y, 544, 26, index % 2 === 0 ? "white" : "surface", true);
    canvas.wrap(row.account, x + 8, y + 9, 246, 8, "navy", false, 8, 1);
    canvas.fitText(row.ledgerFolio, x + 270, y + 9, 36, 7.5, "slate", false, 5.5);
    canvas.fitText(row.debit ? plainAmount(row.debit) : "-", x + 328, y + 9, 92, 8, "navy", true, 6);
    canvas.fitText(row.credit ? plainAmount(row.credit) : "-", x + 446, y + 9, 92, 8, "navy", true, 6);
    canvas.line(x + 260, y, x + 260, y + 26, "border", 0.4);
    canvas.line(x + 308, y, x + 308, y + 26, "border", 0.4);
    canvas.line(x + 426, y, x + 426, y + 26, "border", 0.4);
    y -= 26;
  });
  if (mapped.length > 24) {
    canvas.text(`+ ${mapped.length - 24} more accounts in CSV/Excel export`, x + 8, y + 9, 7, "blue", true);
    y -= 20;
  }
  canvas.rect(x, y, 544, 28, "soft", true);
  canvas.text("Total", x + 122, y + 10, 9, "navy", true);
  canvas.fitText(plainAmount(debitTotal), x + 328, y + 10, 92, 9, "blue", true, 6);
  canvas.fitText(plainAmount(creditTotal), x + 446, y + 10, 92, 9, "blue", true, 6);
  canvas.text(Math.abs(debitTotal - creditTotal) < 0.01 ? "Balanced" : `Difference: ${money(debitTotal - creditTotal)}`, x + 8, y - 18, 8, Math.abs(debitTotal - creditTotal) < 0.01 ? "blue" : "gold", true);

  canvas.line(48, 64, 564, 64, "border", 0.5);
  canvas.text(`${report.businessName} | Trial Balance`, 48, 46, 7.2, "muted");
  canvas.text(`Generated by Solva Trade on ${report.generatedAt}`, 286, 46, 7.2, "muted");
  return pdfDocument(canvas.output(), 612, 842, assets);
}

function balanceSheetGroups(report: Report) {
  const rows = report.lines.filter((line) => line.sku !== "LEDGER" && line.sku !== "TOTAL");
  const pick = (terms: string[]) =>
    rows.filter((line) => {
      const source = `${line.details?.Section ?? ""} ${line.details?.Class ?? ""} ${line.details?.Classification ?? ""} ${line.description}`.toLowerCase();
      return terms.some((term) => source.includes(term));
    });
  const assets = pick(["asset", "cash", "receivable", "inventory", "prepaid", "equipment", "property", "goodwill"]);
  const liabilities = pick(["liabil", "payable", "loan", "debt", "accrued", "unearned"]);
  const equity = pick(["equity", "capital", "drawing", "retained"]);
  return { assets, liabilities, equity };
}

function drawBalanceSection(canvas: PdfCanvas, title: string, rows: ReportLine[], x: number, y: number, width: number) {
  canvas.text(title, x, y, 12, "cyan", true);
  canvas.line(x, y - 6, x + width, y - 6, "cyan", 0.8);
  let cursorY = y - 28;
  let total = 0;
  rows.slice(0, 8).forEach((line, index) => {
    const amount = statementAmount(line);
    total += amount;
    canvas.wrap(line.description, x + 6, cursorY, 250, 7.2, index % 2 ? "slate" : "navy", false, 8, 1);
    canvas.fitText(money(amount), x + 318, cursorY, 94, 7.2, "slate", true, 5.6);
    canvas.fitText("KES 0.00", x + 470, cursorY, 94, 7.2, "muted", true, 5.6);
    cursorY -= 16;
  });
  if (!rows.length) {
    canvas.text("No posted account balances yet", x + 6, cursorY, 7.2, "muted");
    cursorY -= 16;
  }
  canvas.line(x, cursorY + 6, x + width, cursorY + 6, "border", 0.8);
  canvas.text(`Total ${title}`, x + 6, cursorY - 7, 7.6, "navy", true);
  canvas.fitText(money(total), x + 318, cursorY - 7, 94, 7.6, "navy", true, 5.8);
  canvas.fitText("KES 0.00", x + 470, cursorY - 7, 94, 7.6, "muted", true, 5.8);
  return { y: cursorY - 32, total };
}

async function balanceSheetPdf(report: Report) {
  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "portrait");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const groups = balanceSheetGroups(report);

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 0, 612, 16, "cyan");
  canvas.text("SOLVA TRADE", 88, 430, 68, "watermark", true);
  canvas.text("Balance Sheet", 48, 762, 30, "cyan", true);
  canvas.text(`Year ending ${report.transaction["Document date"]}`, 52, 712, 11, "slate", true);
  canvas.text(new Date(`${report.transaction["Document date"]}T00:00:00.000Z`).getUTCFullYear().toString(), 330, 712, 11, "slate", true);
  canvas.text("Previous", 482, 712, 11, "slate", true);
  canvas.rect(492, 736, 62, 62, "gold");
  if (!drawFittedImage(canvas, tenantLogo, 502, 746, 42, 42)) canvas.text("Logo", 512, 766, 10, "white", true);
  canvas.text(report.businessName, 52, 734, 10, "navy", true);

  const assetsResult = drawBalanceSection(canvas, "Assets", groups.assets, 48, 682, 516);
  const liabilitiesResult = drawBalanceSection(canvas, "Liabilities", groups.liabilities, 48, assetsResult.y, 516);
  const equityResult = drawBalanceSection(canvas, "Shareholder's Equity", groups.equity, 48, liabilitiesResult.y, 516);
  const totalLiabilitiesEquity = liabilitiesResult.total + equityResult.total;
  canvas.line(48, equityResult.y + 18, 564, equityResult.y + 18, "navy", 0.8);
  canvas.text("Total Liabilities & Shareholder's Equity", 54, equityResult.y + 4, 7.8, "navy", true);
  canvas.fitText(money(totalLiabilitiesEquity), 366, equityResult.y + 4, 94, 7.8, "navy", true, 5.8);
  canvas.text(`Balance check: ${money(assetsResult.total - totalLiabilitiesEquity)}`, 54, equityResult.y - 18, 7.4, Math.abs(assetsResult.total - totalLiabilitiesEquity) < 0.01 ? "blue" : "gold", true);

  canvas.text(`Generated by Solva Trade on ${report.generatedAt}`, 48, 34, 7.2, "muted");
  return pdfDocument(canvas.output(), 612, 842, assets);
}

function cashFlowSections(report: Report) {
  const rows = report.lines.filter((line) => line.sku !== "LEDGER" && line.sku !== "TOTAL");
  const operating: Array<{ label: string; amount: number; indent?: boolean }> = [];
  const investing: Array<{ label: string; amount: number; indent?: boolean }> = [];
  const financing: Array<{ label: string; amount: number; indent?: boolean }> = [];
  rows.forEach((line) => {
    const source = `${line.details?.Section ?? ""} ${line.details?.Class ?? ""} ${line.description}`.toLowerCase();
    const amount = statementAmount(line);
    if (source.includes("asset") && (source.includes("equipment") || source.includes("property") || source.includes("investment"))) {
      investing.push({ label: line.description, amount, indent: true });
    } else if (source.includes("liabil") || source.includes("loan") || source.includes("capital") || source.includes("equity") || source.includes("drawing")) {
      financing.push({ label: line.description, amount, indent: true });
    } else {
      operating.push({ label: line.description, amount, indent: true });
    }
  });
  const sum = (items: Array<{ amount: number }>) => items.reduce((total, item) => total + item.amount, 0);
  return { operating, investing, financing, operatingTotal: sum(operating), investingTotal: sum(investing), financingTotal: sum(financing) };
}

function drawCashFlowSection(canvas: PdfCanvas, title: string, subtitle: string, rows: Array<{ label: string; amount: number; indent?: boolean }>, totalLabel: string, total: number, x: number, y: number) {
  canvas.text(title, x, y, 10, "navy", true);
  canvas.text(subtitle, x, y - 16, 9, "navy");
  let cursorY = y - 32;
  rows.slice(0, 7).forEach((row) => {
    canvas.wrap(row.label, x + (row.indent ? 42 : 0), cursorY, 310, 8, "navy", false, 9, 1);
    canvas.fitText(plainAmount(row.amount), x + 394, cursorY, 92, 8, "navy", true, 6);
    cursorY -= 16;
  });
  if (!rows.length) {
    canvas.text("No posted cash movement in this section", x + 42, cursorY, 8, "muted");
    cursorY -= 16;
  }
  canvas.line(x, cursorY + 6, x + 486, cursorY + 6, "border", 0.6);
  canvas.text(totalLabel, x, cursorY - 7, 9, "navy", true);
  canvas.fitText(plainAmount(total), x + 394, cursorY - 7, 92, 9, "navy", true, 6);
  return cursorY - 28;
}

async function cashFlowPdf(report: Report) {
  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "portrait");
  const sections = cashFlowSections(report);
  const netChange = sections.operatingTotal + sections.investingTotal + sections.financingTotal;
  const opening = 0;
  const closing = opening + netChange;

  canvas.rect(0, 0, 612, 842, "white");
  canvas.text(report.businessName, 58, 778, 20, "navy", true);
  canvas.text(`For the year ending ${report.transaction["Document date"]}`, 414, 780, 10, "navy");
  canvas.text("Cash Flow Statement (KES)", 58, 718, 13, "navy", true);
  canvas.text("current year", 462, 720, 10, "navy");
  canvas.text(new Date(`${report.transaction["Document date"]}T00:00:00.000Z`).getUTCFullYear().toString(), 490, 704, 10, "navy", true);
  canvas.rect(56, 684, 500, 18, "surface");
  canvas.text("Cash balance at beginning of year", 58, 668, 10, "navy", true);
  canvas.fitText(plainAmount(opening), 452, 668, 94, 10, "navy", true, 7);
  canvas.rect(56, 646, 500, 8, "surface");

  let y = drawCashFlowSection(canvas, "Operations", "Cash receipts and payments from operating activity", sections.operating, "Net cash flow from operations", sections.operatingTotal, 58, 624);
  y = drawCashFlowSection(canvas, "Investing activities", "Cash receipts and payments for long-term assets", sections.investing, "Net cash flow from investing activities", sections.investingTotal, 58, y);
  y = drawCashFlowSection(canvas, "Financing activities", "Cash receipts and payments from owners and lenders", sections.financing, "Net cash flow from financing activities", sections.financingTotal, 58, y);
  canvas.rect(56, Math.max(92, y + 4), 500, 8, "surface");
  canvas.text("Net change in cash", 58, Math.max(72, y - 14), 10, "navy", true);
  canvas.fitText(plainAmount(netChange), 452, Math.max(72, y - 14), 94, 10, "navy", true, 7);
  canvas.rect(56, Math.max(44, y - 34), 500, 8, "surface");
  canvas.text("Cash balance at end of year", 58, Math.max(24, y - 56), 10, "navy", true);
  canvas.fitText(plainAmount(closing), 452, Math.max(24, y - 56), 94, 10, "navy", true, 7);
  return pdfDocument(canvas.output(), 612, 842, assets);
}

async function generalLedgerPdf(report: Report) {
  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "portrait");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const rows = report.lines.filter((line) => line.sku !== "LEDGER" && line.sku !== "TOTAL");
  const entries = rows.map((line) => {
    const debit = detailAmount(line.details?.Debit ?? money(line.unitPrice));
    const credit = detailAmount(line.details?.Credit ?? money(line.discount));
    return {
      account: line.description,
      explanation: line.notes || `${line.details?.Section ?? line.batch} ledger movement.`,
      ref: line.sku || "-",
      debit,
      credit,
      section: String(line.details?.Section ?? line.batch ?? "Ledger"),
    };
  });
  const debitTotal = entries.reduce((sum, row) => sum + row.debit, 0);
  const creditTotal = entries.reduce((sum, row) => sum + row.credit, 0);
  const year = new Date(`${report.transaction["Document date"]}T00:00:00.000Z`).getUTCFullYear().toString();

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 832, 612, 10, "blue");
  canvas.rect(204, 832, 204, 10, "cyan");
  canvas.rect(408, 832, 204, 10, "gold");
  canvas.text("SOLVA TRADE", 88, 430, 68, "watermark", true);
  canvas.rect(48, 760, 50, 46, "surface");
  if (!drawFittedImage(canvas, tenantLogo, 52, 764, 42, 38)) canvas.text(initials(report.businessName), 60, 780, 15, "blue", true);
  canvas.text(report.businessName, 108, 798, 13, "navy", true);
  canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 108, 780, 242, 7.6, "slate");
  canvas.text(report.processName.toLowerCase().includes("account ledger") ? "Account Ledger" : "General Journal", 244, 740, 15, "navy", true);
  canvas.rect(450, 768, 94, 28, "navy");
  if (!drawFittedImage(canvas, solvaLogo, 454, 772, 86, 20)) canvas.text("SOLVA TRADE", 462, 778, 9, "white", true);

  const x = 42;
  let y = 694;
  const widths = [34, 34, 292, 44, 70, 70];
  canvas.line(x, y + 18, x + 528, y + 18, "navy", 0.8);
  canvas.line(x, y + 14, x + 528, y + 14, "navy", 0.5);
  canvas.rect(x, y - 46, 528, 60, "white", true);
  canvas.text("Date", x + 28, y - 28, 9, "navy", true);
  canvas.text("Account Title and Explanations", x + 152, y - 28, 9, "navy", true);
  canvas.text("Ref", x + 372, y - 28, 9, "navy", true);
  canvas.text("Amount (KES)", x + 424, y + 2, 9, "navy", true);
  canvas.text("Debit", x + 420, y - 28, 8.4, "navy", true);
  canvas.text("Credit", x + 490, y - 28, 8.4, "navy", true);
  let headerLineX = x;
  widths.slice(0, -1).forEach((width) => {
    headerLineX += width;
    canvas.line(headerLineX, y - 46, headerLineX, y + 14, "border", 0.5);
  });
  canvas.line(x, y - 48, x + 528, y - 48, "navy", 1.6);

  y -= 72;
  canvas.text(year, x + 20, y + 12, 8, "navy", true);
  const maxEntries = 14;
  entries.slice(0, maxEntries).forEach((entry, index) => {
    const blockHeight = 40;
    const month = index === 0 ? new Intl.DateTimeFormat("en-KE", { month: "short", timeZone: "Africa/Nairobi" }).format(new Date(`${report.transaction["Document date"]}T00:00:00.000Z`)) : "";
    canvas.text(month, x + 8, y - 2, 7.2, "navy", true);
    canvas.text(String(index + 1).padStart(2, "0"), x + 46, y - 2, 7.2, "navy", true);
    canvas.wrap(entry.credit && !entry.debit ? `    ${entry.account}` : entry.account, x + 78, y - 2, 240, 8.2, "navy", false, 9, 1);
    canvas.wrap(`(${entry.explanation})`, x + 78, y - 18, 244, 6.6, "slate", false, 7.4, 1);
    canvas.fitText(entry.ref, x + 366, y - 2, 34, 7.2, "slate", false, 5.4);
    canvas.fitText(entry.debit ? plainAmount(entry.debit) : "", x + 420, y - 2, 60, 7.6, "navy", false, 5.6);
    canvas.fitText(entry.credit ? plainAmount(entry.credit) : "", x + 490, y - 2, 60, 7.6, "navy", false, 5.6);
    canvas.line(x + 68, y - blockHeight + 8, x + 400, y - blockHeight + 8, "border", 0.4);
    [x + 34, x + 68, x + 360, x + 404, x + 474].forEach((lineX) => canvas.line(lineX, y + 20, lineX, y - blockHeight + 8, "border", 0.35));
    y -= blockHeight;
  });
  if (entries.length > maxEntries) {
    canvas.text(`+ ${entries.length - maxEntries} more ledger lines in CSV/Excel export`, x + 78, y + 2, 7, "blue", true);
    y -= 24;
  }
  canvas.line(x, y + 10, x + 528, y + 10, "navy", 1.6);
  canvas.text("Total", x + 204, y - 24, 9, "navy", true);
  canvas.fitText(money(debitTotal), x + 408, y - 24, 68, 8.6, "navy", true, 6);
  canvas.fitText(money(creditTotal), x + 478, y - 24, 68, 8.6, "navy", true, 6);
  canvas.line(x, y - 42, x + 528, y - 42, "navy", 0.8);
  canvas.line(x, y - 46, x + 528, y - 46, "navy", 0.5);
  canvas.text(Math.abs(debitTotal - creditTotal) < 0.01 ? "Balanced general ledger" : `Ledger difference: ${money(debitTotal - creditTotal)}`, x + 8, y - 64, 7.4, Math.abs(debitTotal - creditTotal) < 0.01 ? "blue" : "gold", true);

  canvas.text(`Generated by Solva Trade on ${report.generatedAt}`, 48, 34, 7.2, "muted");
  return pdfDocument(canvas.output(), 612, 842, assets);
}

async function bankReconciliationPdf(report: Report) {
  const canvas = new PdfCanvas();
  const assets = await pdfAssets(report, "portrait");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const lines = report.lines.filter((line) => line.sku !== "LEDGER" && line.sku !== "TOTAL");
  const cashLines = lines.filter((line) => {
    const value = `${line.description} ${line.batch} ${line.details?.Class ?? ""}`.toLowerCase();
    return value.includes("cash") || value.includes("bank") || value.includes("mpesa") || value.includes("m-pesa");
  });
  const sourceLines = cashLines.length ? cashLines : lines;
  const deposits = sourceLines.filter((line) => detailAmount(line.details?.Debit ?? money(line.unitPrice)) > 0);
  const withdrawals = sourceLines.filter((line) => detailAmount(line.details?.Credit ?? money(line.discount)) > 0);
  const bankOpening = sourceLines.reduce((sum, line) => sum + detailAmount(line.details?.Closing ?? money(line.lineTotal)), 0);
  const depositTotal = deposits.reduce((sum, line) => sum + detailAmount(line.details?.Debit ?? money(line.unitPrice)), 0);
  const outstandingTotal = withdrawals.reduce((sum, line) => sum + detailAmount(line.details?.Credit ?? money(line.discount)), 0);
  const adjustedBank = bankOpening + depositTotal - outstandingTotal;
  const bookOpening = adjustedBank;
  const receivableCollected = 0;
  const interestEarned = 0;
  const bookAdditions = receivableCollected + interestEarned;
  const serviceCharges = 0;
  const nsfChecks = 0;
  const bookDeductions = nsfChecks + serviceCharges;
  const adjustedBook = bookOpening + bookAdditions - bookDeductions;
  const closing = adjustedBook;
  const periodDate = new Date(`${report.transaction["Document date"]}T00:00:00.000Z`);
  const periodLabel = new Intl.DateTimeFormat("en-KE", { month: "long", day: "numeric", year: "numeric", timeZone: "Africa/Nairobi" }).format(periodDate);

  function amount(value: number, x: number, y: number, width = 92, bold = false, color: keyof typeof pdfColors = "navy") {
    canvas.fitText(value ? money(value) : "-", x, y, width, 9, color, bold, 6.2);
  }

  function underline(x: number, y: number, width: number, heavy = false) {
    canvas.line(x, y, x + width, y, "black", heavy ? 1.1 : 0.55);
  }

  function row(label: string, value: number, y: number, indent = 0, bold = false, total = false) {
    canvas.text(label, 58 + indent, y, 9.2, "black", bold);
    amount(value, 466, y, 88, bold, total ? "black" : "blue");
    if (total) underline(464, y - 4, 92, bold);
  }

  canvas.rect(0, 0, 612, 842, "white");
  canvas.text("SOLVA TRADE", 84, 432, 70, "watermark", true);
  canvas.rect(0, 805, 612, 38, "navy");
  canvas.rect(0, 805, 204, 38, "blue");
  canvas.rect(204, 805, 204, 38, "cyan");
  canvas.rect(408, 805, 204, 38, "gold");
  if (!drawFittedImage(canvas, tenantLogo, 52, 814, 72, 22)) canvas.text(initials(report.businessName), 62, 817, 13, "white", true);
  canvas.text(report.businessName, 138, 826, 13, "white", true);
  canvas.text("Bank reconciliation control", 138, 812, 7.8, "white");
  if (!drawFittedImage(canvas, solvaLogo, 458, 814, 92, 22)) canvas.text("SOLVA TRADE", 470, 818, 10, "white", true);

  canvas.rect(40, 762, 532, 24, "soft");
  canvas.text("Bank Reconciliation Statement", 50, 769, 14, "blue", true);
  canvas.text(report.businessName, 58, 724, 10, "black", true);
  canvas.text("Bank Reconciliation Statement", 58, 706, 10, "black", true);
  canvas.text(`Period Ended ${periodLabel}`, 58, 688, 10, "black", true);
  canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 58, 668, 312, 7.2, "slate", false, 8.4, 2);
  canvas.text(`Generated: ${report.generatedAt}`, 408, 724, 7.4, "muted");
  canvas.text(`Reference: ${report.transaction["Reference number"]}`, 408, 710, 7.4, "muted");

  let y = 632;
  row(`Cash balance as per bank statement, ${periodLabel}`, bankOpening, y);
  y -= 20;
  row("Add: Deposits in transit", depositTotal, y);
  y -= 10;
  underline(464, y, 92);
  y -= 16;
  amount(bankOpening + depositTotal, 466, y, 88, false, "black");
  y -= 42;
  row("Deduct: Outstanding cheques / bank payments not yet cleared", outstandingTotal, y);
  y -= 10;
  underline(464, y, 92);
  y -= 28;
  row("Adjusted cash balance", adjustedBank, y, 0, true, true);

  y -= 48;
  row("Balance as per depositor's record", bookOpening, y);
  y -= 20;
  row("Add: Receivables collected by bank", receivableCollected, y);
  y -= 20;
  row("Interest earned", interestEarned, y, 34);
  y -= 10;
  underline(464, y, 92);
  y -= 16;
  amount(bookOpening + bookAdditions, 466, y, 88, false, "black");
  y -= 42;
  row("Deduction: NSF / reversed customer payments", nsfChecks, y);
  y -= 20;
  row("Bank service charges and posting differences", serviceCharges, y, 34);
  y -= 10;
  underline(464, y, 92);
  y -= 16;
  amount(bookDeductions, 466, y, 88, false, "black");
  y -= 32;
  row("Adjusted cash balance", closing, y, 0, true, true);

  canvas.rect(58, 92, 496, 44, "surface");
  canvas.text("RECONCILIATION NOTE", 76, 116, 7.4, "blue", true);
  canvas.wrap(
    `This statement compares posted bank/cash ledger activity with the book balance. Book-side additions and deductions stay at zero until bank collections, interest, charges, reversals or NSF items are posted as finance records.`,
    76,
    102,
    452,
    7.1,
    "slate",
    false,
    8.6,
    3,
  );
  canvas.text(`${report.businessName} | Bank Reconciliation Statement`, 48, 42, 7.2, "muted");
  canvas.text(`Prepared by ${report.generatedBy} via Solva Trade`, 332, 42, 7.2, "muted");
  return pdfDocument(canvas.output(), 612, 842, assets);
}

async function landscapePdf(report: Report) {
  let canvas = new PdfCanvas();
  const style = blueprintFor(report);
  const title = titleFor(report);
  const recordCount = report.lines.length.toLocaleString("en-KE");
  const catalogueDocument = isCustomerPriceListReport(report.moduleName, report.processName);
  const assets = await pdfAssets(report, "landscape");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");
  const headers = wideReportHeaders(report);
  const rows = report.lines.map((line, index) => headers.map((header) => valueForHeader(report, line, index, header)));
  const widths = wideTableWidths(headers, report);
  const pages: string[] = [];

  const drawChrome = (pageNumber: number, compact = false) => {
    canvas.rect(0, 0, 842, 595, "white");
    canvas.rect(0, 586, 842, 9, "navy");
    canvas.rect(0, 586, 280, 9, "blue");
    canvas.rect(280, 586, 280, 9, "cyan");
    canvas.rect(560, 586, 282, 9, "gold");
    canvas.text("SOLVA TRADE", 214, 300, 54, "watermark", true);
    canvas.text("Run. Grow. Lead.", 332, 280, 15, "watermark");

    canvas.rect(48, compact ? 520 : 500, compact ? 42 : 54, compact ? 38 : 50, "surface");
    if (!drawFittedImage(canvas, tenantLogo, 52, compact ? 524 : 504, compact ? 34 : 46, compact ? 30 : 42)) {
      canvas.text(initials(report.businessName), compact ? 59 : 61, compact ? 536 : 520, compact ? 13 : 17, "blue", true);
    }
    canvas.text(report.businessName, compact ? 104 : 118, compact ? 548 : 538, compact ? 13 : 17, "navy", true);
    canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, compact ? 104 : 118, compact ? 532 : 518, compact ? 330 : 330, 8, "slate");
    canvas.text(title, 482, compact ? 548 : 538, compact ? 15 : 18, "navy", true);
    canvas.text(style.label, 484, compact ? 530 : 518, 8, "blue", true);
    canvas.text(`Reference: ${report.transaction["Reference number"]}`, 484, compact ? 516 : 504, 8, "muted");
    canvas.rect(700, compact ? 522 : 506, 94, 28, "navy");
    if (!drawFittedImage(canvas, solvaLogo, 704, compact ? 525 : 509, 86, 22)) {
      canvas.text("SOLVA", 714, compact ? 534 : 518, 12, "white", true);
      canvas.text("TRADE", 760, compact ? 534 : 518, 9, "cyan", true);
    }
    canvas.text(`Page ${pageNumber}`, 744, 494, 7.2, "muted");
  };

  drawChrome(1);

  canvas.rect(48, 444, 746, 42, "soft");
  const customerStatementDocument = isCustomerSalesStatementReport(report.moduleName, report.processName);
  const statementPeriod = report.lines[0]?.details?.Period ?? `${report.transaction["Document date"]} to ${report.transaction["Due / action date"]}`;
  const detailCards = catalogueDocument
    ? [
        ["Prepared for", report.partyName],
        ["Price list date", report.transaction["Document date"]],
        ["Products listed", recordCount],
        ["Currency", report.transaction.Currency],
      ]
    : customerStatementDocument
      ? [
          ["Customer", report.partyName],
          ["Statement period", statementPeriod],
          ["Generated on", report.generatedAt],
          ["Closing balance", report.totals["Closing balance"] ?? report.totals.Total],
        ]
    : [
        ["Generated by", `${report.generatedBy} - ${roleLabel(report.generatedByRole)}`],
        ["Generated on", report.generatedAt],
        ["Scope", `${report.moduleName} | ${report.transaction.Branch}`],
        ["Total records", recordCount],
      ];
  detailCards.forEach(([label, value], index) => {
    const x = 66 + index * 178;
    canvas.text(label.toUpperCase(), x, 468, 6.8, "muted", true);
    canvas.wrap(value, x, 454, 150, 8.5, "navy", index === 3);
  });

  const tableTitleY = catalogueDocument ? 412 : 376;
  const tableStartY = catalogueDocument ? 390 : 354;
  if (!catalogueDocument) {
    const productOrInventoryReport =
      isProductMasterReport(report.moduleName, report.processName) || isInventoryOperationalReport(report.moduleName, report.processName);
    const customerSalesStatementReport = isCustomerSalesStatementReport(report.moduleName, report.processName);
    const supplierProfitReport = isSupplierProfitReport(report.moduleName, report.processName);
    const kpis = [
      productOrInventoryReport
        ? ["Stock value", report.totals.Total]
        : customerSalesStatementReport
          ? ["Opening balance", report.totals["Opening balance"] ?? "KES 0.00"]
          : supplierProfitReport
            ? ["Sales", report.totals.Subtotal]
        : ["Subtotal", report.totals.Subtotal],
      productOrInventoryReport
        ? ["Records", recordCount]
        : customerSalesStatementReport
          ? ["Invoices", report.totals.Invoices ?? "KES 0.00"]
          : supplierProfitReport
            ? ["Supply cost", report.totals.Discount]
            : ["Tax", report.totals.Tax ?? "KES 0.00"],
      productOrInventoryReport
        ? ["Review status", report.lines.length ? "Ready" : "No records"]
        : customerSalesStatementReport
          ? ["Payments", report.totals.Payments ?? "KES 0.00"]
          : supplierProfitReport
            ? ["Gross profit", report.totals.Total]
        : ["Total", report.totals.Total],
    ];
    kpis.forEach(([label, value], index) => {
      const x = 48 + index * 166;
      canvas.rect(x, 396, 150, 32, "surface");
      canvas.text(label.toUpperCase(), x + 12, 416, 6.8, "muted", true);
      canvas.text(value, x + 12, 403, 9.5, "blue", true);
    });
    canvas.wrap(style.footerNote, 562, 420, 232, 7.6, "slate", false, 9);
  } else {
    canvas.wrap(style.footerNote, 48, 420, 746, 7.6, "slate", false, 9);
  }

  canvas.text(catalogueDocument ? "PRICE LIST" : "REPORT DETAILS", 48, tableTitleY, 9, "blue", true);
  let pageNumber = 1;
  let rendered = renderLandscapePdfTablePage(canvas, headers, widths, rows, 0, tableStartY, 52);
  while (rendered.nextRow < rows.length) {
    canvas.line(48, 40, 794, 40, "border", 0.5);
    canvas.text(`${report.businessName} | ${titleFor(report)}`, 48, 24, 7.2, "muted");
    canvas.wrap(
      catalogueDocument
        ? catalogueFooterText(report)
        : `Generated by Solva Trade on ${report.generatedAt}`,
      318,
      26,
      476,
      6.5,
      "muted",
      false,
      7.4,
      2,
    );
    pages.push(canvas.output());
    pageNumber += 1;
    canvas = new PdfCanvas();
    drawChrome(pageNumber, true);
    rendered = renderLandscapePdfTablePage(canvas, headers, widths, rows, rendered.nextRow, 470, 52);
  }

  const footerY = Math.max(36, Math.min(84, rendered.y));
  canvas.line(48, footerY, 794, footerY, "border", 0.5);
  canvas.text(`${report.businessName} | ${titleFor(report)}`, 48, footerY - 16, 7.2, "muted");
  canvas.wrap(
    catalogueDocument
      ? catalogueFooterText(report)
      : `Generated by Solva Trade on ${report.generatedAt}`,
    318,
    footerY - 14,
    476,
    6.5,
    "muted",
    false,
    7.4,
    2,
  );
  pages.push(canvas.output());

  return pdfDocumentPages(pages, 842, 595, assets);
}

function drawCustomerInvoiceHeader(
  canvas: PdfCanvas,
  report: Report,
  title: string,
  assets: PdfImageResource[],
) {
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 832, 612, 10, "blue");
  canvas.rect(204, 832, 204, 10, "cyan");
  canvas.rect(408, 832, 204, 10, "gold");
  canvas.text("SOLVA TRADE", 102, 420, 58, "watermark", true);

  canvas.rect(48, 752, 62, 58, "surface");
  canvas.rect(52, 756, 54, 50, "white");
  if (!drawFittedImage(canvas, tenantLogo, 56, 760, 46, 42)) {
    canvas.text(initials(report.businessName), 65, 778, 15, "blue", true);
  }

  canvas.text(report.businessName, 122, 798, 17, "navy", true);
  canvas.wrap(report.businessLocation, 122, 780, 250, 7.6, "slate", false, 8.4, 1);
  const contactLine = [
    report.businessPhone ? `Tel: ${report.businessPhone}` : "",
    report.businessEmail ? `Email: ${report.businessEmail}` : "",
  ].filter(Boolean).join("  ");
  if (contactLine) canvas.wrap(contactLine, 122, 762, 286, 7, "slate", false, 7.8, 1);
  if (report.kraPin) canvas.text(`KRA PIN: ${report.kraPin}`, 122, 746, 7.2, "slate");

  canvas.wrap(title, 392, 792, 118, 17, "navy", true, 20);
  if (!drawFittedImage(canvas, solvaLogo, 508, 784, 54, 20)) {
    canvas.text("SOLVA", 512, 790, 8.5, "blue", true);
  }
  canvas.text(`# ${report.transaction["Reference number"]}`, 394, 758, 8.5, "muted");
}

function drawCustomerInvoiceParties(canvas: PdfCanvas, report: Report) {
  canvas.rect(48, 684, 250, 50, "soft");
  canvas.rect(314, 684, 250, 50, "soft");
  canvas.text("BILL TO", 62, 716, 8, "blue", true);
  canvas.wrap(report.partyName, 62, 698, 218, 8.4, "navy", true, 9.4, 2);
  canvas.text("DETAILS", 328, 716, 8, "blue", true);
  canvas.text(`No: ${report.transaction["Reference number"]}`, 328, 698, 7.8, "navy");
  canvas.text(`Date: ${report.transaction["Document date"]}`, 328, 685, 7.8, "navy");
  canvas.text(`Due: ${report.transaction["Due or action date"]}`, 438, 685, 7.8, "navy");
}

function drawCustomerInvoiceTableHeader(canvas: PdfCanvas, report: Report, y: number) {
  const headers = lineHeaders(report);
  const widths = pdfTableWidths(report, headers);
  let cursor = 48;
  canvas.rect(48, y - 16, 530, 20, "navy");
  headers.forEach((header, index) => {
    canvas.wrap(header, cursor + 4, y - 4, (widths[index] ?? 64) - 8, 6.2, "white", true, 7.4, 1);
    cursor += widths[index] ?? 64;
  });
}

async function customerInvoicePdf(report: Report) {
  const title = titleFor(report);
  const assets = await pdfAssets(report, "portrait");
  const headers = lineHeaders(report);
  const widths = pdfTableWidths(report, headers);
  const rowValues = report.lines.map((line, index) => lineCells(report, line, index));
  const pages: string[] = [];
  let pageNumber = 1;
  let canvas = new PdfCanvas();
  let y = 612;

  const startPage = (withParties: boolean) => {
    canvas = new PdfCanvas();
    drawCustomerInvoiceHeader(canvas, report, title, assets);
    if (withParties) {
      drawCustomerInvoiceParties(canvas, report);
      y = 656;
    } else {
      y = 704;
    }
    drawCustomerInvoiceTableHeader(canvas, report, y);
    y -= 22;
  };

  const finishPage = () => {
    canvas.line(48, 58, 564, 58, "border");
    pages.push(canvas.output());
    pageNumber += 1;
  };

  startPage(true);

  if (!rowValues.length) {
    canvas.rect(48, y - 30, 530, 34, "soft");
    canvas.text("No line items found for this invoice.", 210, y - 10, 8, "muted");
    y -= 42;
  }

  rowValues.forEach((row, rowIndex) => {
    const lineCounts = row.map((cell, index) => wrapLineCount(cell, (widths[index] ?? 64) - 8, 5.8, index === 1 ? 2 : 1));
    const height = Math.max(17, Math.max(...lineCounts) * 7 + 8);
    if (y - height < 126) {
      finishPage();
      startPage(false);
    }
    canvas.rect(48, y - height + 5, 530, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(48, y + 5, 578, y + 5, "border", 0.5);
    let cursor = 48;
    row.forEach((cell, index) => {
      const numeric = index >= headers.length - 4;
      canvas.wrap(cell || "-", cursor + 4, y - 4, (widths[index] ?? 64) - 8, 5.8, "navy", false, 7.2, index === 1 ? 2 : 1);
      if (numeric) canvas.line(cursor, y - height + 5, cursor, y + 5, "border", 0.4);
      cursor += widths[index] ?? 64;
    });
    y -= height;
  });

  const totalEntries = displayTotalEntries(report);
  const summaryHeight = 56 + totalEntries.length * 16;
  if (y - summaryHeight < 96) {
    finishPage();
    startPage(false);
  }

  canvas.line(48, y + 4, 578, y + 4, "border", 0.7);
  canvas.text("NOTE TO CUSTOMER", 48, y - 22, 9, "blue", true);
  canvas.wrap("Thanks for choosing us. We appreciate your business.", 48, y - 38, 260, 8, "navy", false, 9.5, 3);
  totalEntries.forEach(([label, value], index) => {
    const rowY = y - 24 - index * 16;
    canvas.rect(384, rowY - 3, 174, 15, "surface");
    canvas.wrap(label, 392, rowY + 1, 74, 7.2, "blue", true, 8, 1);
    canvas.wrap(value, 472, rowY + 1, 78, 7.2, "blue", true, 8, 1);
  });

  finishPage();
  return pdfDocumentPages(pages, 612, 842, assets);
}

async function pdf(report: Report) {
  if (isProfitAndLossReport(report)) return profitAndLossPdf(report);
  if (isTrialBalanceReport(report)) return trialBalancePdf(report);
  if (isBalanceSheetReport(report)) return balanceSheetPdf(report);
  if (isCashFlowStatementReport(report)) return cashFlowPdf(report);
  if (isGeneralLedgerReport(report)) return generalLedgerPdf(report);
  if (isBankReconciliationReport(report)) return bankReconciliationPdf(report);
  if (isLandscapePdfReport(report)) return landscapePdf(report);
  if (isCustomerFacingInvoice(report)) return customerInvoicePdf(report);

  const canvas = new PdfCanvas();
  const title = titleFor(report);
  const template = templateFor(report);
  const style = blueprintFor(report);
  const dailyDocument = isDayToDayDocument(report);
  const customerSalesStatement = isCustomerSalesStatementReport(report.moduleName, report.processName);
  const approvalTitle = report.generatedByRole === "owner" ? "OWNER CERTIFICATION AND AUDIT" : "APPROVAL AND AUDIT";
  const assets = await pdfAssets(report, "portrait");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 832, 612, 10, "blue");
  canvas.rect(204, 832, 204, 10, "cyan");
  canvas.rect(408, 832, 204, 10, "gold");
  canvas.text("SOLVA TRADE", 88, 430, 68, "watermark", true);
  canvas.text("Run. Grow. Lead.", 212, 408, 18, "watermark", false);

  canvas.rect(48, 744, 80, 72, "surface");
  canvas.rect(52, 748, 72, 64, "white");
  if (!drawFittedImage(canvas, tenantLogo, 56, 752, 64, 56)) {
    canvas.rect(56, 752, 64, 56, "surface");
    canvas.text(initials(report.businessName), 70, 778, 22, "blue", true);
  }
  canvas.text(report.businessName, 134, 794, 20, "navy", true);
  canvas.wrap(report.businessLocation, 134, 774, 240, 8.5, "slate");
  if (report.businessPhone) canvas.text(`Phone: ${report.businessPhone}`, 134, 750, 8.5, "slate");
  if (report.businessEmail) canvas.text(`Email: ${report.businessEmail}`, 134, 738, 8.5, "slate");
  if (report.kraPin) canvas.text(`KRA PIN: ${report.kraPin}`, 134, 726, 8.5, "slate");

  canvas.wrap(title, 372, 792, 190, 17, "navy", true, 20);
  canvas.text(style.label, 374, 746, 8, "blue", true);
  canvas.text(`# ${report.transaction["Reference number"]}`, 374, 732, 8.5, "muted");
  canvas.text(`Generated: ${report.generatedAt}`, 374, 718, 7.5, "muted");
  canvas.rect(432, 678, 132, 28, "navy");
  if (!drawFittedImage(canvas, solvaLogo, 438, 682, 120, 20)) {
    canvas.text("SOLVA", 446, 690, 13, "white", true);
    canvas.text("TRADE", 494, 690, 10, "cyan", true);
    canvas.text("Run. Grow. Lead.", 446, 681, 6.5, "gold", false);
  }

  let tableStart = 572;
  if (template === "salesReceipt") {
    const status = receiptPaymentStatus(report);
    canvas.rect(48, 628, 516, 72, "navy");
    canvas.text("AMOUNT RECEIVED", 66, 678, 8.5, "cyan", true);
    canvas.fitText(report.totals["Amount paid"] ?? report.totals.Total, 66, 656, 156, 22, "white", true, 12);
    canvas.text(`Receipt No. ${report.transaction["Reference number"]}`, 250, 674, 9, "white", true);
    canvas.wrap(`Received from: ${report.partyName}`, 250, 658, 136, 7.8, "white", false, 8.8, 2);
    canvas.text(`Date: ${report.transaction["Document date"]}`, 250, 634, 7.5, "white");
    canvas.text(`Invoice: ${report.transaction["Invoice no."] ?? report.transaction["Reference number"]}`, 404, 674, 8, "white", true);
    canvas.text(`Amount: ${report.totals["Amount paid"] ?? report.totals.Total}`, 404, 658, 7.5, "white");
    canvas.wrap(`Payment: ${report.transaction["Payment terms"]}`, 404, 644, 132, 7, "white", false, 8, 1);
    canvas.rect(48, 590, 516, 28, status.tone === "paid" ? "soft" : "surface");
    canvas.text(status.label, 66, 600, 17, status.tone === "paid" ? "blue" : "navy", true);
    canvas.wrap(status.detail, 202, 602, 330, 8, "slate", true, 9, 2);
    tableStart = 572;
  } else if (template === "grn") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text("SUPPLIER / PARTY DETAILS", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text("GRN DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`GRN No: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text(`PO No: ${report.transaction["Reference number"].replace("GOO", "PO")}`, 328, 642, 8.5, "navy");
    canvas.text(`Receiving branch: ${report.transaction.Branch}`, 328, 628, 8.5, "navy");
    tableStart = 594;
  } else if (template === "purchaseOrder") {
    canvas.rect(48, 646, 160, 54, "navy");
    canvas.rect(220, 646, 160, 54, "surface");
    canvas.rect(392, 646, 172, 54, "surface");
    canvas.text("VENDOR", 62, 678, 8, "cyan", true);
    canvas.wrap(report.partyName, 62, 662, 128, 9, "white", true);
    canvas.text("SHIP TO", 234, 678, 8, "blue", true);
    canvas.wrap(report.businessName, 234, 662, 128, 9, "navy", true);
    canvas.text("P.O DETAILS", 406, 678, 8, "blue", true);
    canvas.text(report.transaction["Reference number"], 406, 662, 8.5, "navy", true);
    tableStart = 614;
  } else if (template === "deliveryNote" || template === "dispatchNote") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text(template === "dispatchNote" ? "ROUTE / VEHICLE" : "DELIVER TO", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text(template === "dispatchNote" ? "DISPATCH CONTROL" : "DELIVERY DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`Doc No: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text(`Branch: ${report.transaction.Branch}`, 328, 642, 8.5, "navy");
    tableStart = 594;
  } else if (template === "statement" || template === "finance" || template === "cashbook" || template === "paymentVoucher" || template === "report" || template === "inventoryReport" || template === "stockMovement" || template === "executiveReport") {
    const labels = customerSalesStatement
      ? ["Customer", "Movements", "Closing"]
      : template === "report" || template === "executiveReport"
        ? ["Health", "Cash / Value", "Risk"]
        : ["Opening", "Movements", "Closing"];
    [48, 224, 400].forEach((x, index) => {
      canvas.rect(x, 652, 164, 42, "surface");
      canvas.text(labels[index], x + 12, 676, 7, "blue", true);
      const value = customerSalesStatement
        ? index === 0
          ? report.partyName
          : index === 1
            ? report.totals.Total
            : report.totals["Balance due"]
        : index === 0
          ? "Ready"
          : index === 1
            ? report.totals.Total
            : report.totals["Balance due"];
      canvas.wrap(value, x + 12, 662, 140, customerSalesStatement ? 8.4 : 16, "navy", true, customerSalesStatement ? 9.2 : 18, customerSalesStatement ? 2 : 1);
    });
    tableStart = customerSalesStatement ? 628 : 614;
  } else if (template === "creditNote" || template === "debitNote") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text(template === "creditNote" ? "CREDIT TO" : "DEBIT TO", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text("ADJUSTMENT DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`Original Ref: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text("Reason: approved adjustment", 328, 642, 8.5, "navy");
    tableStart = 594;
  } else {
    if (dailyDocument) {
      canvas.rect(48, 628, 250, 72, "soft");
      canvas.rect(314, 628, 250, 72, "soft");
      canvas.text("BILL TO", 62, 676, 9, "blue", true);
      canvas.wrap(report.partyName, 62, 656, 210, 10, "navy", true);
      canvas.text("INVOICE DETAILS", 328, 676, 9, "blue", true);
      canvas.text(`Invoice no.: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
      canvas.text(`Invoice date: ${report.transaction["Document date"]}`, 328, 642, 8.5, "navy");
      canvas.text(`Due date: ${report.transaction["Due or action date"]}`, 328, 628, 8.5, "navy");
    } else {
      canvas.rect(48, 628, 160, 72, "soft");
      canvas.rect(224, 628, 160, 72, "soft");
      canvas.rect(400, 628, 164, 72, "soft");
      canvas.text("BILL TO", 62, 676, 9, "blue", true);
      canvas.wrap(report.partyName, 62, 656, 124, 10, "navy", true);
      canvas.text("SUPPLY / DELIVERY", 238, 676, 9, "blue", true);
      canvas.wrap(report.transaction.Branch, 238, 656, 124, 10, "navy", true);
      canvas.text("INVOICE DETAILS", 414, 676, 9, "blue", true);
      canvas.text(`Date: ${report.transaction["Document date"]}`, 414, 656, 8.5, "navy");
      canvas.text(`Due: ${report.transaction["Due or action date"]}`, 414, 642, 8.5, "navy");
    }
    tableStart = 594;
  }

  const yAfterTable = renderPdfTable(canvas, report, tableStart);

  const summaryTop = Math.max(236, Math.min(536, yAfterTable));
  const totalEntries = displayTotalEntries(report);

  canvas.text(dailyDocument ? "TOTAL" : "TOTALS", 384, summaryTop, 10, "blue", true);
  totalEntries.forEach(([label, value], index) => {
    const isGrand = label === "Total" || label === "Amount paid" || label === "Balance due" || label === "Amount due";
    const y = summaryTop - 18 - index * 16;
    canvas.rect(384, y - 3, 174, 15, isGrand ? "surface" : "white");
    canvas.wrap(label, 392, y + 1, 78, 7.2, isGrand ? "blue" : "slate", isGrand, 8, 1);
    canvas.wrap(value, 472, y + 1, 78, 7.2, isGrand ? "blue" : "navy", true, 8, 1);
  });

  const paymentTop = summaryTop - 24 - totalEntries.length * 16;
  if (shouldShowPaymentInstructions(report) && paymentTop >= 144) {
    canvas.rect(384, paymentTop - 52, 174, 58, "soft");
    canvas.text("HOW TO PAY", 394, paymentTop - 10, 7.2, "blue", true);
    report.paymentInstructions.slice(0, 3).forEach((line, index) => {
      canvas.wrap(line, 394, paymentTop - 24 - index * 12, 154, 6.2, "navy", false, 7.2, 1);
    });
  }

  if (dailyDocument) {
    const noteTitle = template === "grn" ? "RECEIVING NOTE" : template === "purchaseOrder" ? "SUPPLIER NOTE" : "NOTE TO CUSTOMER";
    const noteBody = template === "grn"
      ? "Goods received as listed. Rejected or damaged quantities should be noted before signing."
      : template === "purchaseOrder"
        ? "Please quote this document number on delivery notes and invoices."
        : "Thanks for choosing us. We appreciate your business.";
    canvas.text(noteTitle, 48, summaryTop, 10, "blue", true);
    canvas.wrap(noteBody, 48, summaryTop - 18, 286, 8.2, "navy", false, 10.2, 4);
  } else if (!customerSalesStatement) {
    canvas.text(approvalTitle, 48, summaryTop, 10, "blue", true);
    Object.entries(report.approvals).slice(0, 4).forEach(([label, value], index) => {
      const y = summaryTop - 18 - index * 22;
      canvas.text(`${label}:`, 48, y + 1, 7.2, "muted", true);
      canvas.wrap(value, 116, y + 1, 218, 7.2, "navy", false, 8.2, 2);
    });
  }

  const signatureLabels = signatureLabelsFor(report);
  if (signatureLabels.length) {
    [48, 242, 436].forEach((x, index) => {
      canvas.line(x, 96, x + 128, 96, "navy");
      canvas.wrap(signatureLabels[index] ?? "", x + 16, 82, 104, 8, "slate");
    });
  }
  if (template === "salesReceipt") {
    const status = receiptPaymentStatus(report);
    canvas.rect(48, 112, 516, 28, "soft");
    canvas.text("SALES RECEIPT SLIP", 62, 126, 7.5, "blue", true);
    canvas.text(status.label, 230, 126, 10, "blue", true);
    canvas.fitText(`Amount received: ${report.totals["Amount paid"] ?? report.totals.Total}`, 370, 126, 170, 7.2, "navy", true, 6);
  }
  canvas.line(48, 58, 564, 58, "border");
  canvas.wrap(
    dailyDocument || customerSalesStatement
      ? `${report.businessName} document generated by Solva Trade on ${report.generatedAt}.`
      : `${report.businessName} document generated by Solva Trade. ${style.footerNote} Printed by ${report.generatedBy} on ${report.generatedAt}.`,
    76,
    42,
    460,
    7.5,
    "muted",
  );

  return pdfDocument(canvas.output(), 612, 842, assets);
}

async function recordDocumentGeneration(report: Report, format: string) {
  const businessId = await activeReportBusinessId();
  if (!businessId) return;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sourceReference =
      report.transaction["Reference number"] ||
      report.transaction["Invoice number"] ||
      report.transaction["GRN number"] ||
      report.transaction["Receipt number"] ||
      `${report.moduleName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    await supabase.from("workflow_records").insert({
      business_id: businessId,
      branch_id: branch?.id ?? null,
      module_name: report.moduleName,
      process_name: report.processName,
      document_name: report.processName,
      intent: `Generated ${format.toUpperCase()}`,
      status: "generated",
      reference_number: `DOC-${Date.now().toString().slice(-10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      record_payload: {
        generated_document: {
          format,
          source_reference: sourceReference,
          party_name: report.partyName,
          total: report.totals.Total,
          line_count: report.lines.length,
          generated_at: report.generatedAt,
          generated_by: report.generatedBy,
        },
      },
      created_by: userId,
    });
  } catch (error) {
    console.warn("Document generation audit log skipped", error);
  }
}

async function exportResponse(searchParams: URLSearchParams) {
  const requestedModuleName = searchParams.get("module") ?? "Operations";
  const requestedProcessName = searchParams.get("process") ?? "Business Process";
  const pinError = requireOwnerProfitPin(searchParams, requestedModuleName, requestedProcessName);
  if (pinError) return pinError;

  const report = await buildReport(searchParams);
  const format = searchParams.get("format") ?? "csv";
  const filename = slug(`${report.moduleName}-${report.processName}`);

  if (format === "json") {
    return Response.json(report);
  }

  await recordDocumentGeneration(report, format);

  if (format === "pdf") {
    return new Response(await pdf(report), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  if (format === "excel") {
    return new Response(htmlDocument(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`,
      },
    });
  }

  if (format === "print") {
    return new Response(`${htmlDocument(report, true)}<script>window.addEventListener("load",()=>window.print())</script>`, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}.html"`,
      },
    });
  }

  return new Response(csv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    return await exportResponse(request.nextUrl.searchParams);
  } catch (error) {
    console.error("Solva export GET failed", {
      module: request.nextUrl.searchParams.get("module"),
      process: request.nextUrl.searchParams.get("process"),
      invoiceId: request.nextUrl.searchParams.get("invoiceId"),
      grnId: request.nextUrl.searchParams.get("grnId"),
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(error instanceof Error ? error.message : "The document could not be generated.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const searchParams = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") continue;
      if (key === "format") searchParams.set(key, value);
      else searchParams.append(key, value);
    }
    return exportResponse(searchParams);
  } catch (error) {
    console.error("Solva export POST failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(error instanceof Error ? error.message : "The document could not be generated.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
