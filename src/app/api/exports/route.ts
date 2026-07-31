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
    value.includes("deal loss reasons report") ||
    value.includes("monthly retail sales summary report") ||
    value.includes("monthly sales report dashboard") ||
    value.includes("quarterly sales report") ||
    value.includes("annual sales performance report") ||
    value.includes("year-end sales report")
  );
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
    .select("allocated_at, quantity, sale_value, sale_unit_price, gross_profit")
    .eq("business_id", businessId)
    .order("allocated_at", { ascending: true })
    .limit(1000);

  const grouped = new Map<string, { revenue: number; units: number; grossProfit: number }>();
  for (const row of data ?? []) {
    const date = row.allocated_at ? new Date(String(row.allocated_at)) : new Date();
    const key = new Intl.DateTimeFormat("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(date);
    const current = grouped.get(key) ?? { revenue: 0, units: 0, grossProfit: 0 };
    current.revenue += numberValue(row.sale_value);
    current.units += numberValue(row.quantity);
    current.grossProfit += numberValue(row.gross_profit);
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
      "source_type, source_supplier_name, quantity, unit_cost, total_cost, sale_unit_price, sale_value, gross_profit, allocated_at, products(product_name, product_code, sku), sales_invoices(invoice_number, invoice_date, customers(customer_name))",
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
    const margin = Number(row.sale_value ?? 0) ? (Number(row.gross_profit ?? 0) / Number(row.sale_value ?? 1)) * 100 : 0;

    return {
      sku: String(product?.sku ?? product?.product_code ?? invoice?.invoice_number ?? "SALE"),
      description: `${String(product?.product_name ?? "Sold product")} - ${String(invoice?.invoice_number ?? "invoice")} ${customer?.customer_name ? `for ${customer.customer_name}` : ""}`.trim(),
      unit: "Unit",
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unit_cost ?? 0),
      discount: Number(row.sale_unit_price ?? 0),
      taxRate: `${margin.toFixed(1)}% margin`,
      taxAmount: Number(row.total_cost ?? 0),
      lineTotal: Number(row.gross_profit ?? 0),
      warehouse: String(row.source_supplier_name ?? "Source supplier not recorded"),
      batch: sourceLabel(String(row.source_type ?? "unspecified")),
      notes: Number(row.gross_profit ?? 0) >= 0
        ? "Positive gross profit from this FIFO/source allocation."
        : "Loss-making source allocation; review buying price, selling price or urgency.",
    };
  });
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
  customers?: { customer_name?: string | null; customer_code?: string | null } | { customer_name?: string | null; customer_code?: string | null }[] | null;
  branches?: { branch_name?: string | null; branch_code?: string | null } | { branch_name?: string | null; branch_code?: string | null }[] | null;
};

type SalesItemRow = {
  invoice_id?: string | null;
  product_id?: string | null;
  invoice_quantity?: number | string | null;
  unit_price?: number | string | null;
  tax_amount?: number | string | null;
  line_total?: number | string | null;
  products?: { product_name?: string | null; product_code?: string | null; sku?: string | null; standard_cost?: number | string | null } | { product_name?: string | null; product_code?: string | null; sku?: string | null; standard_cost?: number | string | null }[] | null;
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

function dateKey(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : todayIsoDate();
}

function dayName(value: string) {
  return new Intl.DateTimeFormat("en-KE", { weekday: "short", timeZone: "Africa/Nairobi" }).format(new Date(`${value}T00:00:00.000Z`)).toUpperCase();
}

function monthKey(value: string | null | undefined) {
  return new Intl.DateTimeFormat("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date(`${dateKey(value)}T00:00:00.000Z`));
}

function quarterKey(value: string | null | undefined) {
  const date = new Date(`${dateKey(value)}T00:00:00.000Z`);
  return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function hourKey(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Nairobi" }).format(date).slice(0, 2) + ":00";
}

function relatedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

async function salesOperationalData() {
  const businessId = await activeReportBusinessId();
  if (!businessId) return { invoices: [] as SalesInvoiceRow[], items: [] as SalesItemRow[], allocations: [] as { product_id?: string | null; gross_profit?: number | string | null; total_cost?: number | string | null; sale_value?: number | string | null; quantity?: number | string | null }[] };

  const supabase = await createSupabaseServerClient();
  const [{ data: invoices }, { data: items }, { data: allocations }] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, invoice_date, subtotal, tax_total, total_amount, amount_paid, balance_due, status, delivery_status, created_at, customers(customer_name, customer_code), branches(branch_name, branch_code)")
      .eq("business_id", businessId)
      .order("invoice_date", { ascending: true })
      .limit(1000),
    supabase
      .from("sales_invoice_items")
      .select("invoice_id, product_id, invoice_quantity, unit_price, tax_amount, line_total, products(product_name, product_code, sku, standard_cost)")
      .eq("business_id", businessId)
      .limit(2000),
    supabase
      .from("sales_source_allocations")
      .select("product_id, quantity, total_cost, sale_value, gross_profit")
      .eq("business_id", businessId)
      .limit(2000),
  ]);

  return {
    invoices: (invoices ?? []) as SalesInvoiceRow[],
    items: (items ?? []) as SalesItemRow[],
    allocations: (allocations ?? []) as { product_id?: string | null; gross_profit?: number | string | null; total_cost?: number | string | null; sale_value?: number | string | null; quantity?: number | string | null }[],
  };
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
  const tax = numberValue(item.tax_amount);
  const total = numberValue(item.line_total);
  const amount = Math.max(0, total - tax);
  return {
    sku: String(product?.sku ?? product?.product_code ?? `ITEM-${index + 1}`),
    description: String(product?.product_name ?? "Sold item"),
    unit: "Unit",
    quantity,
    unitPrice,
    discount: numberValue(product?.standard_cost),
    taxRate: amount ? `${((tax / amount) * 100).toFixed(1)}%` : "No VAT",
    taxAmount: tax,
    lineTotal: total,
    warehouse: invoice ? dateKey(invoice.invoice_date) : "Posted sales",
    batch: String(invoice?.invoice_number ?? "Invoice"),
    notes: `Customer: ${String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer")}.`,
    details: {
      "Item no": String(product?.product_code ?? product?.sku ?? ""),
      "Item name": String(product?.product_name ?? "Sold item"),
      "Item description": String(product?.product_name ?? "Sold item"),
      Price: money(unitPrice),
      Qty: quantity.toLocaleString("en-KE", { maximumFractionDigits: 2 }),
      Amount: money(amount),
      "Tax rate": amount ? `${((tax / amount) * 100).toFixed(1)}%` : "0%",
      Tax: money(tax),
      Total: money(total),
      "Invoice no.": String(invoice?.invoice_number ?? ""),
      Date: invoice ? dateKey(invoice.invoice_date) : todayIsoDate(),
      Customer: String(relatedOne(invoice?.customers)?.customer_name ?? "Walk-in customer"),
      "Invoice subtotal": money(numberValue(invoice?.subtotal)),
      "Invoice tax": money(numberValue(invoice?.tax_total)),
      "Invoice total": money(numberValue(invoice?.total_amount)),
      "Amount paid": money(numberValue(invoice?.amount_paid)),
      "Balance due": money(numberValue(invoice?.balance_due)),
      "Payment status": String(invoice?.status ?? "posted"),
    },
  };
}

async function salesInvoiceDocumentLines(invoiceId: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId || !invoiceId) return [];

  const supabase = await createSupabaseServerClient();
  const [{ data: invoices }, { data: items }] = await Promise.all([
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
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const invoice = ((invoices ?? [])[0] ?? undefined) as SalesInvoiceRow | undefined;
  return ((items ?? []) as SalesItemRow[]).map((item, index) => itemBaseLine(item, invoice, index));
}

async function goodsReceivedDocumentLines(grnId: string | null): Promise<ReportLine[]> {
  const businessId = await activeReportBusinessId();
  if (!businessId || !grnId) return [];

  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from("goods_received_note_items")
    .select("grn_id, supplier_batch, expiry_date, delivered_quantity, accepted_quantity, rejected_quantity, unit_cost, source_type, source_reason, products(product_name, product_code, sku)")
    .eq("business_id", businessId)
    .eq("grn_id", grnId)
    .order("created_at", { ascending: true })
    .limit(300);

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

function productSalesTrackingLines(items: SalesItemRow[], invoicesById: Map<string, SalesInvoiceRow>, allocations: { product_id?: string | null; gross_profit?: number | string | null; total_cost?: number | string | null; sale_value?: number | string | null; quantity?: number | string | null }[]): ReportLine[] {
  const profitByProduct = new Map<string, { profit: number; cost: number; saleValue: number; qty: number }>();
  for (const allocation of allocations) {
    const key = String(allocation.product_id ?? "unknown");
    const current = profitByProduct.get(key) ?? { profit: 0, cost: 0, saleValue: 0, qty: 0 };
    current.profit += numberValue(allocation.gross_profit);
    current.cost += numberValue(allocation.total_cost);
    current.saleValue += numberValue(allocation.sale_value);
    current.qty += numberValue(allocation.quantity);
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
    current.profit = allocation?.profit ?? current.revenue - current.tax - current.cost;
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

async function salesOperationalReportLines(processName: string): Promise<ReportLine[]> {
  const { invoices, items, allocations } = await salesOperationalData();
  const invoicesById = new Map(invoices.map((invoice) => [String(invoice.id), invoice]));
  const lower = processName.toLowerCase();

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

function titleFor(report: Report) {
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
    headers: ["Code", "Description", "Qty", "Unit Price", "Discount", "Tax", "Amount"],
    signatures: ["Prepared by", "Customer / recipient", "Owner"],
    footerNote: "This invoice states the amount due from the customer. Tax details are shown where applicable.",
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
  if (value.includes("cash flow") || value.includes("income statement") || value.includes("profit") || value.includes("balance sheet") || value.includes("trial balance") || value.includes("ledger") || value.includes("budget") || value.includes("expense analysis")) {
    return { ...base, accent: "#071A2B", soft: "#F8FAFC", label: "Financial statement", table: "Financial statement lines", headers: ["Account Code", "Account Name", "Opening", "Debit", "Credit", "Closing", "Variance"], signatures: ["Prepared by", "Accountant", "Owner / Director"], footerNote: "Financial statements should reconcile to posted ledger entries and approved periods.", emphasis: "ledger" };
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
  if (value.includes("ledger") || value.includes("trial balance") || value.includes("balance sheet") || value.includes("income statement")) return "finance";
  if (value.includes("report") || value.includes("brief") || value.includes("dashboard")) return "report";
  return "taxInvoice";
}

function shouldShowPaymentInstructions(report: Report) {
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

function paymentInstructionHtml(report: Report) {
  if (!shouldShowPaymentInstructions(report)) return "";
  return `<article class="payment-instructions">
    <h3>How to pay</h3>
    <ul>${report.paymentInstructions.map((line) => `<li>${htmlEscape(line)}</li>`).join("")}</ul>
  </article>`;
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
    const businessName = business.trading_name ?? business.legal_name ?? fallback.businessName;
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
  const generatedBy = searchParams.get("generatedBy") ?? searchParams.get("printer") ?? tenant.generatedBy;
  const submittedLines = isProfileDocument(moduleName, processName) ? profileLinesFromFields(fields, processName) : reportLineFromFields(fields, processName);
  const liveSourceLines = invoiceId
    ? await salesInvoiceDocumentLines(invoiceId)
    : grnId
      ? await goodsReceivedDocumentLines(grnId)
      : isPurchaseSourceReport(processName)
        ? await purchaseSourceReportLines(processName)
        : isSalesSourceReport(processName)
          ? await salesSourceReportLines(processName)
          : isSalesOperationalReport(moduleName, processName)
            ? await salesOperationalReportLines(processName)
        : isProductProfileReport(moduleName, processName)
          ? await productMasterReportLines(productId)
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
  const effectivePartyName = liveInvoiceDetails.Customer || partyName;
  const isValuationReport = isProductMasterReport(moduleName, processName) || isProductProfileReport(moduleName, processName) || isInventoryOperationalReport(moduleName, processName);
  const lineValueTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const liveInvoiceTotals = invoiceId && lines[0]?.details
    ? {
        subtotal: detailAmount(lines[0].details["Invoice subtotal"]),
        tax: detailAmount(lines[0].details["Invoice tax"]),
        total: detailAmount(lines[0].details["Invoice total"]),
        paid: detailAmount(lines[0].details["Amount paid"]),
        balance: detailAmount(lines[0].details["Balance due"]),
        status: lines[0].details["Payment status"] ?? "",
      }
    : null;
  const subtotal = isValuationReport
    ? lineValueTotal
    : liveInvoiceTotals?.subtotal
      ? liveInvoiceTotals.subtotal
    : parseAmount(fieldValue(fields, ["subtotal"], "0")) ||
      lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - line.discount), 0);
  const tax = isValuationReport
    ? 0
    : liveInvoiceTotals
      ? liveInvoiceTotals.tax
      : parseAmount(fieldValue(fields, ["tax"], "0")) || lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const discount = isValuationReport ? 0 : parseAmount(fieldValue(fields, ["discount"], "0")) || lines.reduce((sum, line) => sum + line.discount, 0);
  const total =
    (isValuationReport ? lineValueTotal : liveInvoiceTotals?.total || parseAmount(fieldValue(fields, ["total", "amount", "amount_received", "amount_sent"], "0"))) ||
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
  const documentDate = liveInvoiceDetails.Date || fieldValue(fields, ["invoice_date", "receipt_date", "payment_date", "received_date", "date", "delivery_date", "needed_by", "as_of_date"], todayIsoDate());
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
    } else if (isCustomerProfileReport(moduleName, processName)) {
      processStatus = "Live customer profile from saved customer records";
      sourceAuditNote = "Customer profile values come from the saved customer record, default address, branch, credit limit, balance, contact details and payment terms.";
    } else if (isInventoryOperationalReport(moduleName, processName)) {
      processStatus = "Live inventory report from saved products, balances, movement and sales allocation records";
      sourceAuditNote = "Inventory report values come from saved products, stock balances, reorder controls, latest receipts and posted sales allocations where applicable.";
    } else if (isSalesOperationalReport(moduleName, processName)) {
      processStatus = "Live sales report from posted invoices, invoice items, customers and source-cost allocations";
      sourceAuditNote = "Sales report values come from posted invoices, invoice items, customers, branches and FIFO/source-cost allocations where available.";
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
      "Invoice no.": liveInvoiceDetails["Invoice no."] || fieldValue(fields, ["invoice_number"], reference),
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
      Tax: money(tax),
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
  const detailHeaders = [
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
  const auditNotes = report.auditTrail.join(" | ");
  const rows = report.lines.map((line, index) => [
    report.moduleName,
    report.processName,
    report.businessName,
    report.businessLocation,
    report.businessPhone,
    report.businessEmail,
    report.paymentInstructions.join(" | "),
    report.kraPin,
    report.partyName,
    report.generatedBy,
    report.generatedAt,
    report.transaction["Reference number"],
    report.transaction["Document date"],
    report.transaction["Due or action date"],
    report.transaction.Branch,
    report.transaction.Currency,
    report.transaction["Payment terms"],
    report.transaction["Process status"],
    line.sku,
    line.description,
    line.unit,
    String(line.quantity),
    money(line.unitPrice),
    money(line.discount),
    line.taxRate,
    money(line.taxAmount),
    money(line.lineTotal),
    line.warehouse,
    line.batch,
    line.notes,
    report.totals.Subtotal,
    report.totals.Tax,
    report.totals.Total,
    report.totals["Balance due"],
    report.approvals.Prepared,
    report.approvals.Reviewed,
    report.approvals.Approved,
    auditNotes,
    ...lineCells(report, line, index),
  ]);

  return [detailHeaders, ...rows]
    .map((row) => row.map((value) => `"${csvSafe(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function logoHtml(report: Report) {
  if (report.businessLogoPath) {
    return `<img src="${htmlEscape(report.businessLogoPath)}" alt="${htmlEscape(report.businessName)} logo" />`;
  }
  if (report.businessName.toLowerCase().includes("cymereg")) {
    return `<img src="/cymereg-enterprises-logo.svg" alt="Cymereg Enterprises logo" />`;
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
  return blueprintFor(report).headers;
}

function valueForHeader(report: Report, line: ReportLine, index: number, header: string) {
  const h = header.toLowerCase();
  const directDetail = line.details?.[header];
  if (directDetail !== undefined) return directDetail;
  const matchingDetail = Object.entries(line.details ?? {}).find(([key]) => key.toLowerCase() === h);
  if (matchingDetail) return matchingDetail[1];
  if (h === "#" || h.includes("s/no") || h.includes("line") || h.includes("stop")) return String(index + 1);
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
  if (report.generatedByRole === "owner") {
    return ["Issued by Business Owner", "Received / acknowledged by", "Date and stamp"];
  }
  return blueprintFor(report).signatures.slice(0, 3);
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
  const lineRows = report.lines
    .map(
      (line, index) => `<tr>${lineCells(report, line, index)
        .map((cell, cellIndex) => `<td class="${cellIndex >= headers.length - 3 ? "num" : ""}">${htmlEscape(cell)}</td>`)
        .join("")}</tr>`,
    )
    .join("") || `<tr><td colspan="${headers.length}" class="empty-row">No posted records found for the selected filters.</td></tr>`;
  const totalRows = Object.entries(report.totals)
    .map(([label, value], index, all) => `<tr class="${index === all.length - 1 ? "grand" : ""}"><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");
  const approvalRows = Object.entries(report.approvals)
    .map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value)}</dd></div>`)
    .join("");
  const template = templateFor(report);
  const style = blueprintFor(report);
  const approvalTitle = report.generatedByRole === "owner" ? "Owner Certification and Audit" : "Approval and Audit";
  const signatureLabels = signatureLabelsFor(report);

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
    .two-column, .grn-grid, .invoice-grid, .po-grid { display: grid; gap: 18px; }
    .two-column, .grn-grid { grid-template-columns: 1fr 1fr; }
    .invoice-grid, .po-grid { grid-template-columns: 1fr 1fr 1fr; }
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
    .report-kpis small { display: block; margin-top: 4px; color: ${brand.slate}; line-height: 1.4; }
    .reason-box, .terms, .pod-box, .receipt-slip, .payment-instructions { margin-top: 18px; border: 1px solid ${brand.border}; border-radius: 8px; background: ${brand.soft}; padding: 14px; }
    .receipt-slip { display: grid; grid-template-columns: 1fr 220px; border-style: dashed; }
    .receipt-slip strong, .receipt-slip span, .pod-box strong, .pod-box span { display: block; }
    .payment-instructions { border-left: 5px solid ${brand.gold}; background: #fffdf5; }
    .payment-instructions h3 { margin: 0 0 8px; color: ${brand.navy}; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    .payment-instructions ul { margin: 0; padding-left: 18px; color: ${brand.navy}; font-size: 12px; line-height: 1.6; }
    .terms ol { margin: 0; padding-left: 18px; color: ${brand.slate}; font-size: 11px; line-height: 1.6; }
    .table-wrap { position: relative; margin-top: 26px; border: 1px solid ${brand.border}; border-radius: 10px; overflow: hidden; }
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
    .emphasis-operations .box { border-left: 5px solid var(--doc-accent); }
    .emphasis-ledger .table-wrap caption { background: #e2e8f0; color: ${brand.navy}; }
    .emphasis-report .page-note { display: block; }
    .emphasis-control .reason-box { border-left: 5px solid var(--doc-accent); }
    footer { margin-top: 36px; border-top: 1px solid ${brand.border}; padding-top: 12px; color: ${brand.muted}; font-size: 10px; line-height: 1.5; text-align: center; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } }
  </style>
</head>
<body>
  <main class="page template-${template} emphasis-${style.emphasis}" style="--doc-accent: ${style.accent}; --doc-soft: ${style.soft};">
    <div class="accent"></div>
    <div class="watermark">SOLVA TRADE</div>
    <header>
      <section class="tenant">
        <div class="tenant-logo">${logoHtml(report)}</div>
        <div>
          <h1>${htmlEscape(report.businessName)}</h1>
          <p>${htmlEscape(report.businessLocation)}</p>
          ${report.businessPhone ? `<p>Phone: ${htmlEscape(report.businessPhone)}</p>` : ""}
          ${report.businessEmail ? `<p>Email: ${htmlEscape(report.businessEmail)}</p>` : ""}
          ${report.kraPin ? `<p>KRA PIN: ${htmlEscape(report.kraPin)}</p>` : ""}
        </div>
      </section>
      <section class="doc-title">
        <h2>${htmlEscape(titleFor(report))}</h2>
        <p class="ref">${htmlEscape(style.label)}</p>
        <p class="ref"># ${htmlEscape(report.transaction["Reference number"])}</p>
        <p class="ref">Generated ${htmlEscape(report.generatedAt)}</p>
        <div class="solva-mark"><img src="/solva-trade-logo.png" alt="Solva Trade" /></div>
      </section>
    </header>

    <section class="intro">${templateIntro(report)}</section>

    <section class="table-wrap">
      <table>
        <caption>${htmlEscape(style.table)}</caption>
        <thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </section>

    <section class="after-table">
      <article class="panel audit">
        <h3>${htmlEscape(approvalTitle)}</h3>
        <dl class="details">${approvalRows}</dl>
        <ul>${report.auditTrail.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </article>
      <article class="totals">
        <table>${totalRows}</table>
        ${paymentInstructionHtml(report)}
      </article>
    </section>

    <section class="signatures">
      ${signatureLabels.map((label) => `<div class="signature">${htmlEscape(label)}</div>`).join("")}
    </section>

    ${templateOutro(report)}

    <footer>
      ${htmlEscape(report.businessName)} document generated by Solva Trade. Printed by ${htmlEscape(report.generatedBy)} on ${htmlEscape(report.generatedAt)}.
    </footer>
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

  text(value: string, x: number, y: number, size = 10, color = "navy", bold = false) {
    this.ops.push(`BT ${pdfColors[color]} rg ${bold ? "/F2" : "/F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
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
    "Product Master Report": ["Item no.", "Item name", "Brand", "Category", "Stock quantity", "Total value", "Reorder status"],
    "Product Inventory Usage Report": ["Item no.", "Item name", "Qty in stock", "Reorder level", "Qty above / below par", "Order qty", "Total order"],
    "Inventory Aging Report": ["Item no.", "Item name", "Age bucket", "Qty in stock", "Inventory value", "Risk level", "Recommended action"],
    "Inventory Audit Report": ["Item no.", "Item name", "Stock location", "Cost per item", "Stock quantity", "Total value", "VAT treatment"],
    "Inventory Discrepancy Report": ["Item no.", "Item name", "On-hand quantity", "Actual item count", "Inventory discrepancy (auto-fill)", "Reorder level", "Item discontinued?"],
    "Inventory Damage Report": ["Item no.", "Name", "Condition", "Damage report", "Quantity", "Asset value", "Total value"],
    "Sales Tracking Report": ["Product name", "Cost per item", "Markup percentage", "Total sold", "Total revenue", "Profit per item", "Total income"],
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
    const cellLines = row.map((cell, index) => wrapLineCount(cell, (widths[index] ?? 70) - 10, 7, 2));
    const height = Math.max(28, Math.max(...cellLines) * 9 + 14);
    if (y - height < 260) break;
    canvas.rect(x, y - height + 6, 530, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 6, x + 530, y + 6);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell || "-", cursor + 5, y - 8, (widths[index] ?? 70) - 10, 7, "navy", false, 9, 2);
      cursor += widths[index] ?? 70;
    });
    y -= height;
    renderedRows += 1;
  }

  if (renderedRows < rows.length) {
    canvas.rect(x, y - 26, 530, 28, "surface");
    canvas.text(`Showing ${renderedRows} of ${rows.length} rows in PDF. Download Excel or CSV for all columns and all rows.`, x + 12, y - 10, 8, "blue", true);
    y -= 34;
  }

  canvas.line(x, y + 6, x + 530, y + 6, "border");
  return y - 16;
}

function isLandscapePdfReport(report: Report) {
  const template = templateFor(report);
  return ["report", "inventoryReport", "stockMovement", "executiveReport"].includes(template);
}

function pdfDocument(content: string, width: number, height: number, images: PdfImageResource[] = []) {
  const imageStartObject = 6;
  const contentObject = imageStartObject + images.length;
  const xobjectResources = images.length
    ? ` /XObject << ${images.map((image, index) => `/${image.name} ${imageStartObject + index} 0 R`).join(" ")} >>`
    : "";
  const contentBuffer = Buffer.from(content, "utf8");
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
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${xobjectResources} >> /Contents ${contentObject} 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...imageObjects,
    Buffer.concat([Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, "utf8"), contentBuffer, Buffer.from("\nendstream", "utf8")]),
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
    "Product Master Report": ["Item no.", "Item name", "Brand", "Category", "Vendor", "Stock quantity", "Cost per item", "Selling price", "Total value", "Reorder status"],
    "Product Inventory Usage Report": ["Item no.", "Item name", "Vendor", "Qty in stock", "Reorder level", "Qty above / below par", "Order qty", "Total order", "Reorder required (auto-fill)"],
    "Inventory Aging Report": ["Item no.", "Item name", "Brand", "Category", "Last received", "Age bucket", "Qty in stock", "Inventory value", "Risk level", "Recommended action"],
    "Inventory Audit Report": ["Item no.", "Item name", "Vendor", "Stock location", "Cost per item", "Stock quantity", "Total value", "Reorder level", "VAT treatment", "Tracking"],
    "Inventory Discrepancy Report": ["Item no.", "Item name", "Vendor", "On-hand quantity", "Actual item count", "Inventory discrepancy (auto-fill)", "Reorder level", "Item discontinued?"],
    "Inventory Damage Report": ["Item no.", "Name", "Vendor", "Condition", "Damage report", "Quantity", "Asset value", "Total value"],
    "Sales Tracking Report": ["Product name", "Cost per item", "Markup percentage", "Total sold", "Total revenue", "Profit per item", "Total income"],
  };
  const requested = preferred[report.processName] ?? ["Period", "Item no.", "Item name", "Name", "Customer", "Vendor", "Revenue (KES)", "Stock quantity", "Total value", "Status", "Notes"];
  const selected = requested.filter((header) => allHeaders.includes(header));
  return selected.length >= 5 ? selected : allHeaders.slice(0, Math.min(10, allHeaders.length));
}

function wideTableWidths(headers: string[]) {
  const weights = headers.map((header) => {
    const h = header.toLowerCase();
    if (h.includes("name") || h.includes("description") || h.includes("product")) return 2.35;
    if (h.includes("vendor") || h.includes("customer") || h.includes("action") || h.includes("tracking")) return 1.55;
    if (h.includes("value") || h.includes("price") || h.includes("cost") || h.includes("revenue") || h.includes("profit") || h.includes("total")) return 1.15;
    if (h.includes("qty") || h.includes("quantity") || h.includes("level") || h.includes("stock")) return 1.05;
    if (h.includes("status") || h.includes("risk") || h.includes("vat")) return 1.05;
    return 1;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight, index) => {
    const width = Math.floor((weight / total) * 746);
    return index === weights.length - 1 ? 746 - weights.slice(0, -1).reduce((sum, w) => sum + Math.floor((w / total) * 746), 0) : width;
  });
}

function renderLandscapePdfTable(canvas: PdfCanvas, report: Report, startY: number) {
  const headers = wideReportHeaders(report);
  const rows = report.lines.map((line, index) => headers.map((header) => valueForHeader(report, line, index, header)));
  const widths = wideTableWidths(headers);
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
    const cellLines = row.map((cell, index) => wrapLineCount(cell, widths[index] - 10, 6.6, 2));
    const height = Math.max(26, Math.max(...cellLines) * 8 + 13);
    if (y - height < 118) break;
    canvas.rect(x, y - height + 5, 746, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell || "-", cursor + 5, y - 7, widths[index] - 10, 6.6, "navy", false, 8, 2);
      cursor += widths[index];
    });
    y -= height;
    renderedRows += 1;
  }

  if (renderedRows < rows.length) {
    canvas.rect(x, y - 22, 746, 24, "surface");
    canvas.text(`PDF shows ${renderedRows} of ${rows.length} rows for readability. Download Excel or CSV for the complete dataset.`, x + 12, y - 8, 7.5, "blue", true);
    y -= 28;
  }

  canvas.line(x, y + 5, x + 746, y + 5, "border", 0.5);
  return y - 12;
}

async function landscapePdf(report: Report) {
  const canvas = new PdfCanvas();
  const style = blueprintFor(report);
  const title = titleFor(report);
  const recordCount = report.lines.length.toLocaleString("en-KE");
  const assets = await pdfAssets(report, "landscape");
  const tenantLogo = assets.find((asset) => asset.name === "TenantLogo");
  const solvaLogo = assets.find((asset) => asset.name === "SolvaLogo");

  canvas.rect(0, 0, 842, 595, "white");
  canvas.rect(0, 586, 842, 9, "navy");
  canvas.rect(0, 586, 280, 9, "blue");
  canvas.rect(280, 586, 280, 9, "cyan");
  canvas.rect(560, 586, 282, 9, "gold");
  canvas.text("SOLVA TRADE", 214, 300, 54, "watermark", true);
  canvas.text("Run. Grow. Lead.", 332, 280, 15, "watermark");

  canvas.rect(48, 500, 54, 50, "surface");
  if (!drawFittedImage(canvas, tenantLogo, 52, 504, 46, 42)) {
    canvas.text(initials(report.businessName), 61, 520, 17, "blue", true);
  }
  canvas.text(report.businessName, 118, 538, 17, "navy", true);
  canvas.wrap(`${report.businessLocation}${report.kraPin ? ` | KRA PIN: ${report.kraPin}` : ""}`, 118, 518, 330, 8, "slate");
  canvas.text(title, 482, 538, 18, "navy", true);
  canvas.text(style.label, 484, 518, 8, "blue", true);
  canvas.text(`Reference: ${report.transaction["Reference number"]}`, 484, 504, 8, "muted");
  canvas.rect(700, 506, 94, 28, "navy");
  if (!drawFittedImage(canvas, solvaLogo, 704, 509, 86, 22)) {
    canvas.text("SOLVA", 714, 518, 12, "white", true);
    canvas.text("TRADE", 760, 518, 9, "cyan", true);
  }

  canvas.rect(48, 444, 746, 42, "soft");
  const detailCards = [
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

  const kpis = [
    isProductMasterReport(report.moduleName, report.processName) || isInventoryOperationalReport(report.moduleName, report.processName)
      ? ["Stock value", report.totals.Total]
      : ["Subtotal", report.totals.Subtotal],
    isProductMasterReport(report.moduleName, report.processName) || isInventoryOperationalReport(report.moduleName, report.processName)
      ? ["Records", recordCount]
      : ["Tax", report.totals.Tax],
    isProductMasterReport(report.moduleName, report.processName) || isInventoryOperationalReport(report.moduleName, report.processName)
      ? ["Review status", report.lines.length ? "Ready" : "No records"]
      : ["Total", report.totals.Total],
  ];
  kpis.forEach(([label, value], index) => {
    const x = 48 + index * 166;
    canvas.rect(x, 396, 150, 32, "surface");
    canvas.text(label.toUpperCase(), x + 12, 416, 6.8, "muted", true);
    canvas.text(value, x + 12, 403, 9.5, "blue", true);
  });
  canvas.wrap(style.footerNote, 562, 420, 232, 7.6, "slate", false, 9);

  canvas.text("REPORT DETAILS", 48, 376, 9, "blue", true);
  const yAfterTable = renderLandscapePdfTable(canvas, report, 354);

  const footerY = Math.max(36, Math.min(84, yAfterTable));
  canvas.line(48, footerY, 794, footerY, "border", 0.5);
  canvas.text(`${report.businessName} | ${report.processName}`, 48, footerY - 16, 7.2, "muted");
  canvas.text(`Generated by Solva Trade on ${report.generatedAt}`, 318, footerY - 16, 7.2, "muted");
  canvas.text("Page 1 of 1", 746, footerY - 16, 7.2, "muted");

  return pdfDocument(canvas.output(), 842, 595, assets);
}

async function pdf(report: Report) {
  if (isLandscapePdfReport(report)) return landscapePdf(report);

  const canvas = new PdfCanvas();
  const title = titleFor(report);
  const template = templateFor(report);
  const style = blueprintFor(report);
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
    canvas.text(`Sale total: ${report.totals.Total}`, 404, 658, 7.5, "white");
    canvas.text(`Balance: ${report.totals["Balance due"]}`, 404, 644, 7.5, "white");
    canvas.wrap(`Payment: ${report.transaction["Payment terms"]}`, 404, 632, 132, 7, "white", false, 8, 1);
    canvas.rect(48, 590, 516, 28, status.tone === "paid" ? "soft" : "surface");
    canvas.text(status.label, 66, 600, 17, status.tone === "paid" ? "blue" : "navy", true);
    canvas.wrap(status.detail, 202, 602, 330, 8, "slate", true, 9, 2);
    canvas.text("PAYMENT LINE ITEMS", 48, 572, 11, "blue", true);
    tableStart = 550;
  } else if (template === "grn") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text("SUPPLIER / PARTY DETAILS", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text("GRN DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`GRN No: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text(`PO No: ${report.transaction["Reference number"].replace("GOO", "PO")}`, 328, 642, 8.5, "navy");
    canvas.text(`Receiving branch: ${report.transaction.Branch}`, 328, 628, 8.5, "navy");
    canvas.text("GOODS RECEIVED", 48, 594, 11, "blue", true);
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
    canvas.text("ORDER ITEMS", 48, 614, 11, "blue", true);
    tableStart = 592;
  } else if (template === "deliveryNote" || template === "dispatchNote") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text(template === "dispatchNote" ? "ROUTE / VEHICLE" : "DELIVER TO", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text(template === "dispatchNote" ? "DISPATCH CONTROL" : "DELIVERY DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`Doc No: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text(`Branch: ${report.transaction.Branch}`, 328, 642, 8.5, "navy");
    canvas.text(style.table.toUpperCase(), 48, 594, 11, "blue", true);
  } else if (template === "statement" || template === "finance" || template === "cashbook" || template === "paymentVoucher" || template === "report" || template === "inventoryReport" || template === "stockMovement" || template === "executiveReport") {
    const labels = template === "report" || template === "executiveReport" ? ["Health", "Cash / Value", "Risk"] : ["Opening", "Movements", "Closing"];
    [48, 224, 400].forEach((x, index) => {
      canvas.rect(x, 642, 164, 58, "surface");
      canvas.text(labels[index], x + 14, 676, 8, "blue", true);
      canvas.text(index === 0 ? "Ready" : index === 1 ? report.totals.Total : report.totals["Balance due"], x + 14, 654, 16, "navy", true);
    });
    canvas.text(style.table.toUpperCase(), 48, 614, 11, "blue", true);
    tableStart = 592;
  } else if (template === "creditNote" || template === "debitNote") {
    canvas.rect(48, 628, 250, 72, "soft");
    canvas.rect(314, 628, 250, 72, "soft");
    canvas.text(template === "creditNote" ? "CREDIT TO" : "DEBIT TO", 62, 676, 9, "blue", true);
    canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
    canvas.text("ADJUSTMENT DETAILS", 328, 676, 9, "blue", true);
    canvas.text(`Original Ref: ${report.transaction["Reference number"]}`, 328, 656, 8.5, "navy");
    canvas.text("Reason: approved adjustment", 328, 642, 8.5, "navy");
    canvas.text(style.table.toUpperCase(), 48, 594, 11, "blue", true);
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
    canvas.text(style.table.toUpperCase(), 48, 594, 11, "blue", true);
  }

  const yAfterTable = renderPdfTable(canvas, report, tableStart);

  const summaryTop = Math.max(236, Math.min(536, yAfterTable));
  const preferredTotals = template === "salesReceipt"
    ? ["Subtotal", "Tax", "Total", "Amount paid", "Balance due"]
    : ["Subtotal", "Discount", "Tax", "Total", "Amount due", "Balance due"];
  const totalEntries = preferredTotals
    .filter((label, index, list) => report.totals[label] && list.indexOf(label) === index)
    .map((label) => [label, report.totals[label]] as [string, string]);

  canvas.text("TOTALS", 384, summaryTop, 10, "blue", true);
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

  canvas.text(approvalTitle, 48, summaryTop, 10, "blue", true);
  Object.entries(report.approvals).slice(0, 4).forEach(([label, value], index) => {
    const y = summaryTop - 18 - index * 22;
    canvas.text(`${label}:`, 48, y + 1, 7.2, "muted", true);
    canvas.wrap(value, 116, y + 1, 218, 7.2, "navy", false, 8.2, 2);
  });

  const signatureLabels = signatureLabelsFor(report);
  [48, 242, 436].forEach((x, index) => {
    canvas.line(x, 96, x + 128, 96, "navy");
    canvas.wrap(signatureLabels[index] ?? "Approved by", x + 16, 82, 104, 8, "slate");
  });
  if (template === "salesReceipt") {
    const status = receiptPaymentStatus(report);
    canvas.rect(48, 112, 516, 28, "soft");
    canvas.text("SALES RECEIPT SLIP", 62, 126, 7.5, "blue", true);
    canvas.text(status.label, 230, 126, 10, "blue", true);
    canvas.fitText(`Amount received: ${report.totals["Amount paid"] ?? report.totals.Total}`, 370, 126, 170, 7.2, "navy", true, 6);
  }
  canvas.line(48, 58, 564, 58, "border");
  canvas.wrap(`${report.businessName} document generated by Solva Trade. ${style.footerNote} Printed by ${report.generatedBy} on ${report.generatedAt}.`, 76, 42, 460, 7.5, "muted");

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
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
