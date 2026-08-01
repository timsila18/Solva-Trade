"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type SupabaseWorkspaceClient = ReturnType<typeof createSupabaseAdminClient> | Awaited<ReturnType<typeof createSupabaseServerClient>>;

function safeText(value: FormDataEntryValue | null, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function documentFieldParams(formData: FormData) {
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("field_") || typeof value !== "string" || !value.trim()) continue;
    const fieldKey = key.slice("field_".length);
    const label = safeText(formData.get(`label_${fieldKey}`), fieldKey.replaceAll("_", " "));
    params.append(`field_${fieldKey}`, value.trim());
    params.append(`label_${fieldKey}`, label);
  }
  return params;
}

function appendGeneratedDocumentField(params: URLSearchParams, key: string, label: string, value: string | null | undefined) {
  if (!value) return;
  params.set(`field_${key}`, value);
  params.set(`label_${key}`, label);
}

function generatedReferencePrefix(moduleName: string, processName: string, documentName: string) {
  const combined = `${moduleName} ${processName} ${documentName}`.toLowerCase();
  if (combined.includes("quotation")) return { key: "quotation_number", label: "Quotation number", prefix: "QUO" };
  if (combined.includes("sales order")) return { key: "sales_order_number", label: "Sales order number", prefix: "SO" };
  if (combined.includes("invoice")) return { key: "invoice_number", label: "Invoice number", prefix: "INV" };
  if (combined.includes("receipt")) return { key: "receipt_number", label: "Receipt number", prefix: "RCT" };
  if (combined.includes("credit note")) return { key: "credit_note_number", label: "Credit note number", prefix: "CRN" };
  if (combined.includes("debit note")) return { key: "debit_note_number", label: "Debit note number", prefix: "DBN" };
  if (combined.includes("requisition")) return { key: "requisition_number", label: "Requisition number", prefix: "REQ" };
  if (combined.includes("purchase order")) return { key: "po_number", label: "PO number", prefix: "PO" };
  if (combined.includes("goods received") || combined.includes("grn")) return { key: "grn_number", label: "GRN number", prefix: "GRN" };
  if (combined.includes("supplier bill")) return { key: "bill_number", label: "Bill number", prefix: "BILL" };
  if (combined.includes("payment")) return { key: "payment_number", label: "Payment number", prefix: "PAY" };
  if (combined.includes("expense")) return { key: "expense_number", label: "Expense number", prefix: "EXP" };
  if (combined.includes("claim")) return { key: "claim_number", label: "Claim number", prefix: "CLM" };
  if (combined.includes("voucher") || combined.includes("petty cash")) return { key: "voucher_number", label: "Voucher number", prefix: "VCH" };
  if (combined.includes("transfer")) return { key: "transfer_number", label: "Transfer number", prefix: "TRF" };
  if (combined.includes("adjustment")) return { key: "adjustment_number", label: "Adjustment number", prefix: "ADJ" };
  if (combined.includes("count")) return { key: "count_number", label: "Count number", prefix: "CNT" };
  if (combined.includes("delivery run")) return { key: "run_number", label: "Run number", prefix: "RUN" };
  if (combined.includes("loading sheet")) return { key: "loading_sheet_number", label: "Loading sheet number", prefix: "LOAD" };
  if (combined.includes("reconciliation")) return { key: "reconciliation_number", label: "Reconciliation number", prefix: "REC" };
  if (combined.includes("owner transaction")) return { key: "transaction_number", label: "Transaction number", prefix: "OWN" };
  if (combined.includes("staff advance")) return { key: "advance_number", label: "Advance number", prefix: "ADV" };
  return { key: "document_number", label: "Document number", prefix: "DOC" };
}

function generateWorkflowReference(moduleName: string, processName: string, documentName: string) {
  const config = generatedReferencePrefix(moduleName, processName, documentName);
  return {
    ...config,
    value: `${config.prefix}-${Date.now().toString().slice(-8)}`,
  };
}

function getField(formData: FormData, key: string) {
  const value = formData.get(`field_${key}`);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const number = Number(getField(formData, key).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function getBoolean(formData: FormData, key: string) {
  return getField(formData, key).toLowerCase() === "yes";
}

function getRawField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getRawNumber(formData: FormData, key: string) {
  const number = Number(getRawField(formData, key).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function selectedLineIndexes(formData: FormData) {
  const count = getNumber(formData, "line_count");
  return Array.from({ length: count }, (_, index) => index).filter((index) => {
    const selected = getRawField(formData, `field_line_${index}_selected`);
    const productId = getRawField(formData, `field_line_${index}_product_id`);
    const quantity = getRawNumber(formData, `field_line_${index}_quantity`);
    return productId && quantity > 0 && (selected === "yes" || selected === "on");
  });
}

type SalesInvoiceLineInput = {
  index: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

function salesInvoiceLinesFromForm(formData: FormData): SalesInvoiceLineInput[] {
  const indexes = selectedLineIndexes(formData);
  if (indexes.length > 0) {
    return indexes.map((index) => {
      const quantity = getRawNumber(formData, `field_line_${index}_quantity`);
      const unitPrice = getRawNumber(formData, `field_line_${index}_unit_price`);
      const discount = getRawNumber(formData, `field_line_${index}_discount`);
      const taxRate = getRawNumber(formData, `field_line_${index}_tax_rate`);
      const lineSubtotal = Math.max(0, quantity * unitPrice - discount);
      const taxAmount = getRawNumber(formData, `field_line_${index}_tax_amount`) || lineSubtotal * (taxRate / 100);
      const lineTotal = getRawNumber(formData, `field_line_${index}_line_total`) || Math.max(0, lineSubtotal + taxAmount);
      return {
        index,
        productId: getRawField(formData, `field_line_${index}_product_id`),
        quantity,
        unitPrice,
        discount,
        taxRate,
        taxAmount,
        lineSubtotal,
        lineTotal,
      };
    });
  }

  const quantity = getNumber(formData, "quantity") || getNumber(formData, "ordered_quantity");
  const unitPrice = getNumber(formData, "unit_price") || getNumber(formData, "price");
  const discount = getNumber(formData, "discount");
  const lineSubtotal = getNumber(formData, "subtotal") || Math.max(0, quantity * unitPrice - discount);
  const taxAmount = getNumber(formData, "tax");
  const lineTotal = getNumber(formData, "total") || Math.max(0, lineSubtotal + taxAmount);
  return [{
    index: 0,
    productId: getField(formData, "product_id"),
    quantity,
    unitPrice,
    discount,
    taxRate: 0,
    taxAmount,
    lineSubtotal,
    lineTotal,
  }];
}

type GoodsReceivedLineInput = {
  index: number;
  productId: string;
  deliveredQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  unitCost: number;
  batch: string | null;
  expiryDate: string | null;
  directCost: number;
  localCost: number;
  sourceVariance: number;
};

function goodsReceivedLinesFromForm(formData: FormData, sourceType: string): GoodsReceivedLineInput[] {
  const indexes = selectedLineIndexes(formData);
  if (indexes.length > 0) {
    return indexes.map((index) => {
      const deliveredQuantity = getRawNumber(formData, `field_line_${index}_quantity`);
      const rejectedQuantity = getRawNumber(formData, `field_line_${index}_rejected_quantity`);
      const acceptedQuantity = Math.max(0, deliveredQuantity - rejectedQuantity);
      const unitCost = getRawNumber(formData, `field_line_${index}_unit_cost`);
      const directCost = getRawNumber(formData, `field_line_${index}_direct_reference_unit_cost`);
      const localCost = getRawNumber(formData, `field_line_${index}_local_reference_unit_cost`) || (sourceType !== "direct_supplier" ? unitCost : 0);
      return {
        index,
        productId: getRawField(formData, `field_line_${index}_product_id`),
        deliveredQuantity,
        rejectedQuantity,
        acceptedQuantity,
        unitCost,
        batch: getRawField(formData, `field_line_${index}_batch`) || null,
        expiryDate: getRawField(formData, `field_line_${index}_expiry_date`) || null,
        directCost,
        localCost,
        sourceVariance: localCost && directCost ? localCost - directCost : 0,
      };
    });
  }

  const deliveredQuantity = getNumber(formData, "received_quantity");
  const rejectedQuantity = getNumber(formData, "rejected_quantity");
  const acceptedQuantity = getNumber(formData, "accepted_quantity") || Math.max(0, deliveredQuantity - rejectedQuantity) || deliveredQuantity;
  const unitCost = getNumber(formData, "unit_cost");
  const directCost = getNumber(formData, "direct_reference_unit_cost");
  const localCost = getNumber(formData, "local_reference_unit_cost") || (sourceType !== "direct_supplier" ? unitCost : 0);
  return [{
    index: 0,
    productId: getField(formData, "product_id"),
    deliveredQuantity,
    rejectedQuantity,
    acceptedQuantity,
    unitCost,
    batch: getField(formData, "batch") || null,
    expiryDate: getField(formData, "expiry_date") || null,
    directCost,
    localCost,
    sourceVariance: localCost && directCost ? localCost - directCost : 0,
  }];
}

function normalizedLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fieldsPayload(formData: FormData) {
  const fields: Record<string, { label: string; value: string }> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("field_") || typeof value !== "string" || !value.trim()) continue;
    const fieldKey = key.slice("field_".length);
    fields[fieldKey] = {
      label: safeText(formData.get(`label_${fieldKey}`), fieldKey.replaceAll("_", " ")),
      value: value.trim(),
    };
  }
  return fields;
}

function statusFromIntent(intent: string) {
  const value = intent.toLowerCase();
  if (value.includes("draft")) return "draft";
  if (value.includes("validat") || value.includes("preview")) return "validated";
  if (value.includes("generat")) return "generated";
  if (value.includes("post") || value.includes("submit") || value.includes("saved")) return "posted";
  return "submitted";
}

function slugCode(value: string, fallback: string) {
  const code = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (code || fallback).slice(0, 60);
}

function productTypeValue(value: string) {
  const typeMap: Record<string, string> = {
    "stock item": "stock_item",
    service: "service",
    "non-stock item": "non_stock_item",
    "returnable packaging": "returnable_packaging",
    "raw material": "raw_material",
    "finished good": "finished_good",
    consumable: "consumable",
    "expense item": "expense_item",
    other: "other",
  };
  return typeMap[value.trim().toLowerCase()] ?? "stock_item";
}

function sourceTypeValue(value: string) {
  const sourceMap: Record<string, string> = {
    "direct supplier": "direct_supplier",
    direct_supplier: "direct_supplier",
    "local market": "local_market",
    "local market supplier": "local_market",
    local_market: "local_market",
    "spot purchase": "spot_purchase",
    spot_purchase: "spot_purchase",
    "alternative supplier": "alternative_supplier",
    alternative_supplier: "alternative_supplier",
    "emergency purchase": "emergency_purchase",
    emergency_purchase: "emergency_purchase",
    "opening stock": "opening_stock",
    opening_stock: "opening_stock",
  };
  return sourceMap[value.trim().toLowerCase()] ?? "direct_supplier";
}

function supplierTypeValue(value: string) {
  const supplierMap: Record<string, string> = {
    manufacturer: "manufacturer",
    distributor: "distributor",
    wholesaler: "wholesaler",
    "farmer / producer": "farmer_producer",
    "farmer producer": "farmer_producer",
    farmer_producer: "farmer_producer",
    importer: "importer",
    "service provider": "service_provider",
    service_provider: "service_provider",
    contractor: "contractor",
    transporter: "transporter",
    "utility provider": "utility_provider",
    utility_provider: "utility_provider",
    "government entity": "government_entity",
    government_entity: "government_entity",
    individual: "individual",
    other: "other",
  };
  return supplierMap[value.trim().toLowerCase()] ?? "other";
}

function paymentTermsValue(value: string) {
  const termsMap: Record<string, string> = {
    cash: "cash",
    "net 7": "net_7",
    "net 14": "net_14",
    "net 30": "net_30",
    "net 60": "net_60",
    custom: "custom",
  };
  return termsMap[value.trim().toLowerCase()] ?? "net_30";
}

async function getWorkspaceContextForClient(client: SupabaseWorkspaceClient, userId: string, fallbackBusinessId?: string | null) {
  const businessId = (await getActiveBusinessId()) || fallbackBusinessId;
  if (!businessId) throw new Error("No active business was selected.");

  const { data: branch } = await client
    .from("branches")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!branch?.id) throw new Error("Set up a branch before posting transactions.");

  const { data: warehouse } = await client
    .from("warehouses")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true)
    .eq("allow_sales_dispatch", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!warehouse?.id) throw new Error("Set up a sales warehouse before posting transactions.");

  return { businessId, branchId: branch.id as string, warehouseId: warehouse.id as string, userId };
}

async function getSettingsBusinessId(client: SupabaseWorkspaceClient, fallbackBusinessId?: string | null) {
  const businessId = (await getActiveBusinessId()) || fallbackBusinessId;
  if (!businessId) throw new Error("No active business was selected.");
  const { data } = await client
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!data?.id) throw new Error("That business was not found or you do not have access to edit it.");
  return businessId;
}

type SolvaRpcClient = SupabaseWorkspaceClient & {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function availableStock(
  admin: SupabaseWorkspaceClient,
  businessId: string,
  branchId: string,
  warehouseId: string,
  productId: string,
) {
  const { data } = await admin
    .from("stock_balances")
    .select("available_quantity")
    .eq("business_id", businessId)
    .eq("branch_id", branchId)
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId);
  return (data ?? []).reduce((sum, row) => sum + Number(row.available_quantity ?? 0), 0);
}

async function postSalesInvoice(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId, warehouseId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const customerId = getField(formData, "customer_id");
  const lines = salesInvoiceLinesFromForm(formData);
  const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const tax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const paid = getNumber(formData, "amount_paid") || getNumber(formData, "amount_received");
  const invoiceNumber = getField(formData, "invoice_number") || `INV-${Date.now().toString().slice(-8)}`;
  const invoiceDate = getField(formData, "invoice_date") || new Date().toISOString().slice(0, 10);
  const dueDate = getField(formData, "due_date") || invoiceDate;

  if (!customerId) throw new Error("Select a saved customer before submitting the sale.");
  if (!lines.length) throw new Error("Tick at least one product and enter the quantity sold.");
  for (const line of lines) {
    if (!line.productId || line.quantity <= 0) throw new Error("Every selected sale row needs a saved product and quantity.");
    if (line.unitPrice <= 0) throw new Error("Every selected sale row needs a selling price.");
  }

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const { data: products } = await admin
    .from("products")
    .select("id, track_inventory, product_name, standard_cost")
    .eq("business_id", businessId)
    .in("id", productIds);
  const productsById = new Map((products ?? []).map((product) => [String(product.id), product]));
  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (!product) throw new Error("One selected product was not found.");
    if (product.track_inventory) {
      const available = await availableStock(admin, businessId, branchId, warehouseId, line.productId);
      if (available < line.quantity) throw new Error(`Insufficient stock for ${product.product_name}. Available: ${available}.`);
    }
  }

  const { data: invoice, error: invoiceError } = await admin
    .from("sales_invoices")
    .insert({
      business_id: businessId,
      branch_id: branchId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: "posted",
      delivery_status: "ready",
      subtotal,
      tax_total: tax,
      total_amount: total,
      amount_paid: 0,
      balance_due: total,
      created_by: userId,
    })
    .select("id")
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Could not post the invoice.");

  const invoiceItems = lines.map((line) => ({
    business_id: businessId,
    invoice_id: invoice.id,
    product_id: line.productId,
    invoice_quantity: line.quantity,
    delivered_quantity: line.quantity,
    base_quantity: line.quantity,
    unit_price: line.unitPrice,
    tax_amount: line.taxAmount,
    line_total: line.lineTotal,
  }));
  const { data: items, error: itemError } = await admin.from("sales_invoice_items").insert(invoiceItems).select("id, product_id");
  if (itemError || !items?.length) throw new Error(itemError?.message ?? "Could not post invoice items.");

  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (!product?.track_inventory) continue;
    const unitCost = Number(product.standard_cost ?? 0);
    const { data: movement, error: movementError } = await admin.from("stock_movements").insert({
      business_id: businessId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      product_id: line.productId,
      movement_type: "sale",
      direction: "out",
      quantity_base: line.quantity,
      display_quantity: line.quantity,
      unit_conversion_factor: 1,
      unit_cost: unitCost,
      total_cost: unitCost * line.quantity,
      reference_document_type: "sales_invoice",
      reference_document_id: invoice.id,
      reference_number: invoiceNumber,
      reason: "Sale submitted from Solva Trade workflow",
      created_by: userId,
    }).select("id").single();
    if (movementError || !movement) throw new Error(movementError?.message ?? "Could not post stock movement.");

    const invoiceItem = items.find((item) => String(item.product_id) === line.productId);
    if (!invoiceItem?.id) continue;
    const { error: allocationError } = await (admin as SolvaRpcClient).rpc("allocate_sale_fifo_source", {
      target_business_id: businessId,
      target_invoice_id: invoice.id,
      target_invoice_item_id: invoiceItem.id,
      target_stock_movement_id: movement.id,
      target_product_id: line.productId,
      target_branch_id: branchId,
      target_warehouse_id: warehouseId,
      target_quantity: line.quantity,
      target_sale_unit_price: line.unitPrice,
    });
    if (allocationError) throw new Error(allocationError.message);
  }

  const payment = paid > 0 ? await postCustomerPayment(formData, userId, fallbackBusinessId, invoice.id, paid) : null;
  return { invoiceId: String(invoice.id), invoiceNumber, paymentNumber: payment?.paymentNumber ?? null };
}

async function postCustomerPayment(
  formData: FormData,
  userId: string,
  fallbackBusinessId?: string | null,
  invoiceIdOverride?: string,
  amountOverride?: number,
) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const invoiceId = invoiceIdOverride ?? getField(formData, "invoice_id");
  const amount = amountOverride ?? getNumber(formData, "amount");
  const paymentNumber = getField(formData, "payment_number") || `RCPT-${Date.now().toString().slice(-8)}`;
  const paymentDate = getField(formData, "payment_date") || new Date().toISOString();
  const methodCode =
    getField(formData, "payment_method")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "cash";

  if (!invoiceId) throw new Error("Select the unpaid invoice to receive payment against.");
  if (amount <= 0) throw new Error("Enter the amount received.");

  const { data: invoice } = await admin
    .from("sales_invoices")
    .select("id, customer_id, balance_due, amount_paid, total_amount")
    .eq("business_id", businessId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Selected invoice was not found.");
  if (amount > Number(invoice.balance_due ?? 0)) throw new Error(`Payment exceeds invoice balance of KES ${Number(invoice.balance_due ?? 0).toLocaleString("en-KE")}.`);

  const { data: method } = await admin
    .from("payment_methods")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true)
    .eq("code", methodCode)
    .limit(1)
    .maybeSingle();

  const { data: payment, error: paymentError } = await admin
    .from("customer_payments")
    .insert({
      business_id: businessId,
      branch_id: branchId,
      customer_id: invoice.customer_id,
      payment_number: paymentNumber,
      payment_date: paymentDate,
      payment_method_id: method?.id ?? null,
      amount_received: amount,
      currency: "KES",
      transaction_reference: getField(formData, "reference") || null,
      payer_name: getField(formData, "payer_name") || null,
      collected_by: userId,
      status: "allocated",
      source_document_type: "sales_invoice",
      source_document_id: invoiceId,
    })
    .select("id")
    .single();
  if (paymentError || !payment) throw new Error(paymentError?.message ?? "Could not post customer payment.");

  const { error: allocationError } = await admin.from("customer_payment_allocations").insert({
    business_id: businessId,
    customer_payment_id: payment.id,
    invoice_id: invoiceId,
    allocated_amount: amount,
  });
  if (allocationError) throw new Error(allocationError.message);

  const nextPaid = Number(invoice.amount_paid ?? 0) + amount;
  const nextBalance = Math.max(0, Number(invoice.total_amount ?? 0) - nextPaid);
  await admin
    .from("sales_invoices")
    .update({
      amount_paid: nextPaid,
      balance_due: nextBalance,
      status: nextBalance <= 0 ? "paid" : "partially_paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  return {
    paymentNumber,
    amountReceived: amount,
    amountPaid: nextPaid,
    balanceDue: nextBalance,
    totalAmount: Number(invoice.total_amount ?? 0),
    paymentDate,
  };
}

async function postGoodsReceived(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId, warehouseId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  let supplierId = getField(formData, "supplier_id");
  const grnNumber = getField(formData, "grn_number") || `GRN-${Date.now().toString().slice(-8)}`;
  const receiptDate = getField(formData, "received_date") || new Date().toISOString().slice(0, 10);
  const sourceType = sourceTypeValue(getField(formData, "source_type"));
  const lines = goodsReceivedLinesFromForm(formData, sourceType);
  const sourceReason = getField(formData, "source_reason") || null;

  if (!supplierId) {
    const supplierInput = normalizedLookup(getField(formData, "supplier") || getField(formData, "preferred_supplier"));
    if (supplierInput) {
      const { data: suppliers } = await admin
        .from("suppliers")
        .select("id, legal_name, trading_name, supplier_code, primary_phone")
        .eq("business_id", businessId)
        .limit(200);
      const match = (suppliers ?? []).find((supplier) =>
        [supplier.legal_name, supplier.trading_name, supplier.supplier_code, supplier.primary_phone]
          .filter(Boolean)
          .some((value) => normalizedLookup(String(value)) === supplierInput),
      );
      supplierId = match?.id ?? "";
    }
  }

  if (!supplierId) throw new Error("Choose the supplier from the saved supplier list before receiving stock.");
  if (!lines.length) throw new Error("Tick at least one delivered product and enter received quantity.");
  for (const line of lines) {
    if (!line.productId) throw new Error("Every selected receipt row needs a saved product.");
    if (line.acceptedQuantity <= 0) throw new Error("Every selected receipt row needs an accepted quantity greater than zero.");
    if (line.unitCost <= 0) throw new Error("Every selected receipt row needs a purchase unit cost.");
  }

  const { data: supplier } = await admin
    .from("suppliers")
    .select("legal_name, trading_name")
    .eq("business_id", businessId)
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) throw new Error("Selected supplier was not found.");

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const { data: products } = await admin
    .from("products")
    .select("id, product_name")
    .eq("business_id", businessId)
    .in("id", productIds);
  const productsById = new Map((products ?? []).map((product) => [String(product.id), product]));
  for (const line of lines) {
    if (!productsById.has(line.productId)) throw new Error("One selected product was not found.");
  }

  const supplierName = supplier.trading_name || supplier.legal_name;
  const firstDirectCost = lines.find((line) => line.directCost > 0)?.directCost ?? 0;
  const firstLocalCost = lines.find((line) => line.localCost > 0)?.localCost ?? 0;
  const firstVariance = lines.find((line) => line.sourceVariance !== 0)?.sourceVariance ?? 0;
  const { data: grn, error: grnError } = await admin
    .from("goods_received_notes")
    .insert({
      business_id: businessId,
      branch_id: branchId,
      supplier_id: supplierId,
      grn_number: grnNumber,
      supplier_delivery_note_number: getField(formData, "supplier_delivery_note_number") || null,
      receipt_date: receiptDate,
      warehouse_id: warehouseId,
      received_by: userId,
      status: "posted",
      source_type: sourceType,
      source_reason: sourceReason,
      direct_reference_unit_cost: firstDirectCost || null,
      local_reference_unit_cost: firstLocalCost || null,
      source_unit_cost_variance: firstVariance || null,
      notes: [
        sourceReason ? `Source reason: ${sourceReason}` : "",
        firstDirectCost ? `Direct reference cost: ${firstDirectCost}` : "",
        firstLocalCost ? `Local reference cost: ${firstLocalCost}` : "",
      ]
        .filter(Boolean)
        .join("; "),
      posted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (grnError || !grn) throw new Error(grnError?.message ?? "Could not post the GRN.");

  const grnItems = lines.map((line) => ({
    business_id: businessId,
    grn_id: grn.id,
    product_id: line.productId,
    supplier_batch: line.batch,
    expiry_date: line.expiryDate,
    delivered_quantity: line.deliveredQuantity || line.acceptedQuantity,
    accepted_quantity: line.acceptedQuantity,
    rejected_quantity: line.rejectedQuantity,
    base_quantity: line.acceptedQuantity,
    unit_cost: line.unitCost,
    warehouse_id: warehouseId,
    quality_status: line.rejectedQuantity > 0 ? "accepted_with_issues" : "accepted",
    source_type: sourceType,
    direct_reference_unit_cost: line.directCost || null,
    local_reference_unit_cost: line.localCost || null,
    source_unit_cost_variance: line.sourceVariance || null,
    source_reason: sourceReason,
    notes: `Source: ${sourceType.replaceAll("_", " ")} via ${supplierName}`,
  }));
  const { error: itemError } = await admin.from("goods_received_note_items").insert(grnItems);
  if (itemError) throw new Error(itemError.message);

  const movements = lines.map((line) => ({
    business_id: businessId,
    branch_id: branchId,
    warehouse_id: warehouseId,
    product_id: line.productId,
    movement_type: "purchase_receipt",
    direction: "in",
    quantity_base: line.acceptedQuantity,
    display_quantity: line.acceptedQuantity,
    unit_conversion_factor: 1,
    unit_cost: line.unitCost,
    total_cost: line.unitCost * line.acceptedQuantity,
    reference_document_type: "goods_received_note",
    reference_document_id: grn.id,
    reference_number: grnNumber,
    reason: `Goods received from ${supplierName}`,
    notes: `Source: ${sourceType.replaceAll("_", " ")}. ${sourceReason ?? ""}`.trim(),
    source_type: sourceType,
    source_supplier_id: supplierId,
    source_supplier_name: supplierName,
    direct_reference_unit_cost: line.directCost || null,
    local_reference_unit_cost: line.localCost || null,
    source_unit_cost_variance: line.sourceVariance || null,
    source_reason: sourceReason,
    created_by: userId,
  }));
  const { error: movementError } = await admin.from("stock_movements").insert(movements);
  if (movementError) throw new Error(movementError.message);
  return { grnId: String(grn.id), grnNumber };
}

async function createCustomerRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const name = getField(formData, "customer_name");
  if (!name) throw new Error("Enter the customer name.");
  const code = `CUS-${Date.now().toString().slice(-6)}`;
  const { data: customer, error } = await admin.from("customers").insert({
    business_id: businessId,
    branch_id: branchId,
    customer_code: code,
    customer_name: name,
    phone: getField(formData, "phone_number") || null,
    email: getField(formData, "email") || null,
    kra_pin: getField(formData, "kra_pin") || null,
    credit_limit: getNumber(formData, "credit_limit"),
    current_balance: getNumber(formData, "opening_balance"),
    default_payment_terms: getField(formData, "payment_agreement") || "due_immediately",
    created_by: userId,
  }).select("id, customer_code, customer_name").single();
  if (error || !customer) throw new Error(error?.message ?? "Could not save customer.");

  const townOrArea = getField(formData, "town_or_area");
  const deliveryRoute = getField(formData, "delivery_route");
  if (townOrArea || deliveryRoute) {
    const { error: addressError } = await admin.from("customer_addresses").insert({
      business_id: businessId,
      customer_id: customer.id,
      address_label: "Main",
      town: townOrArea || null,
      delivery_instructions: deliveryRoute ? `Preferred route: ${deliveryRoute}` : null,
      contact_person: name,
      contact_phone: getField(formData, "phone_number") || null,
      is_default: true,
      active: true,
    });
    if (addressError) throw new Error(addressError.message);
  }

  return {
    customerId: customer.id as string,
    customerCode: String(customer.customer_code ?? code),
    customerName: String(customer.customer_name ?? name),
  };
}

async function updateCustomerRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const customerId = getField(formData, "customer_id");
  const name = getField(formData, "customer_name");
  if (!customerId) throw new Error("Select a saved customer before editing.");
  if (!name) throw new Error("Enter the customer name.");

  const { data: existing, error: existingError } = await admin
    .from("customers")
    .select("id, customer_code")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message ?? "Customer not found in this business.");

  const { data: customer, error } = await admin
    .from("customers")
    .update({
      branch_id: branchId,
      customer_name: name,
      phone: getField(formData, "phone_number") || null,
      email: getField(formData, "email") || null,
      kra_pin: getField(formData, "kra_pin") || null,
      credit_limit: getNumber(formData, "credit_limit"),
      current_balance: getNumber(formData, "opening_balance"),
      default_payment_terms: getField(formData, "payment_agreement") || "due_immediately",
      active: getField(formData, "customer_status") !== "Inactive",
      status: getField(formData, "customer_status") === "Inactive" ? "inactive" : "active",
    })
    .eq("business_id", businessId)
    .eq("id", customerId)
    .select("id, customer_code, customer_name")
    .single();
  if (error || !customer) throw new Error(error?.message ?? "Could not update customer.");

  const townOrArea = getField(formData, "town_or_area");
  const deliveryRoute = getField(formData, "delivery_route");
  const addressPayload = {
    business_id: businessId,
    customer_id: customer.id,
    address_label: "Main",
    town: townOrArea || null,
    delivery_instructions: deliveryRoute ? `Preferred route: ${deliveryRoute}` : null,
    contact_person: name,
    contact_phone: getField(formData, "phone_number") || null,
    is_default: true,
    active: true,
  };

  const { data: address } = await admin
    .from("customer_addresses")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customer.id)
    .eq("is_default", true)
    .maybeSingle();

  const { error: addressError } = address?.id
    ? await admin.from("customer_addresses").update(addressPayload).eq("business_id", businessId).eq("id", address.id)
    : await admin.from("customer_addresses").insert(addressPayload);
  if (addressError) throw new Error(addressError.message);

  return {
    customerId: customer.id as string,
    customerCode: String(customer.customer_code ?? existing.customer_code),
    customerName: String(customer.customer_name ?? name),
  };
}

async function createSupplierRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId, warehouseId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const legalName = getField(formData, "legal_name");
  if (!legalName) throw new Error("Enter the supplier legal name.");

  const code = getField(formData, "supplier_code") || `SUP-${Date.now().toString().slice(-6)}`;
  const openingBalance = getNumber(formData, "opening_balance");
  const status = getBoolean(formData, "submit_for_approval") ? "pending_approval" : "approved";

  const { data: supplier, error: supplierError } = await admin
    .from("suppliers")
    .insert({
      business_id: businessId,
      supplier_type: supplierTypeValue(getField(formData, "supplier_type")),
      legal_name: legalName,
      trading_name: getField(formData, "trading_name") || null,
      supplier_code: code,
      kra_pin: getField(formData, "kra_pin") || null,
      vat_registered: getBoolean(formData, "vat_registered"),
      registration_number: getField(formData, "registration_number") || null,
      primary_phone: getField(formData, "primary_phone") || null,
      alternative_phone: getField(formData, "alternative_phone") || null,
      email: getField(formData, "email") || null,
      website: getField(formData, "website") || null,
      physical_address: getField(formData, "physical_address") || null,
      postal_address: getField(formData, "postal_address") || null,
      county: getField(formData, "county") || null,
      town: getField(formData, "town") || null,
      country: getField(formData, "country") || "Kenya",
      primary_contact_person: getField(formData, "primary_contact_person") || null,
      default_currency: "KES",
      default_payment_terms: paymentTermsValue(getField(formData, "payment_terms")),
      credit_limit_granted: getNumber(formData, "credit_limit"),
      default_receiving_branch_id: branchId,
      default_receiving_warehouse_id: warehouseId,
      active: true,
      on_hold: false,
      approved_supplier: status === "approved" || getBoolean(formData, "preferred_supplier"),
      supplier_category: getField(formData, "supplier_category") || null,
      status,
      notes: [
        getField(formData, "main_products") ? `Main products: ${getField(formData, "main_products")}` : "",
        getBoolean(formData, "requires_purchase_order") ? "Requires purchase order before supply." : "",
        getBoolean(formData, "bank_details_verified") ? "Bank details verified." : "",
        getField(formData, "notes"),
      ].filter(Boolean).join(" "),
      created_by: userId,
    })
    .select("id")
    .single();
  if (supplierError || !supplier) throw new Error(supplierError?.message ?? "Could not save supplier.");

  const contactName = getField(formData, "primary_contact_person") || legalName;
  if (contactName || getField(formData, "primary_phone") || getField(formData, "email")) {
    const { error } = await admin.from("supplier_contacts").insert({
      business_id: businessId,
      supplier_id: supplier.id,
      contact_name: contactName,
      job_title: getField(formData, "contact_title") || null,
      phone: getField(formData, "primary_phone") || null,
      alternative_phone: getField(formData, "alternative_phone") || null,
      email: getField(formData, "email") || null,
      contact_type: "primary",
      preferred_contact: true,
      notes: getField(formData, "contact_notes") || null,
    });
    if (error) throw new Error(error.message);
  }

  if (getField(formData, "physical_address") || getField(formData, "town") || getField(formData, "county")) {
    const { error } = await admin.from("supplier_addresses").insert({
      business_id: businessId,
      supplier_id: supplier.id,
      address_name: "Main receiving address",
      address_type: "receiving",
      physical_address: getField(formData, "physical_address") || null,
      town: getField(formData, "town") || null,
      county: getField(formData, "county") || null,
      country: getField(formData, "country") || "Kenya",
      contact_person: getField(formData, "primary_contact_person") || null,
      phone: getField(formData, "primary_phone") || null,
      delivery_instructions: getField(formData, "delivery_instructions") || null,
      is_default: true,
    });
    if (error) throw new Error(error.message);
  }

  if (openingBalance > 0) {
    const referenceNumber = `SOB-${Date.now().toString().slice(-8)}`;
    const { error: openingError } = await admin.from("supplier_opening_balances").insert({
      business_id: businessId,
      supplier_id: supplier.id,
      branch_id: branchId,
      reference_number: referenceNumber,
      document_date: new Date().toISOString().slice(0, 10),
      amount: openingBalance,
      balance_type: "outstanding_bill",
      notes: "Opening supplier balance captured during supplier setup.",
      approval_status: "approved",
      posted_at: new Date().toISOString(),
      created_by: userId,
    });
    if (openingError) throw new Error(openingError.message);

    const { error: transactionError } = await admin.from("supplier_transactions").insert({
      business_id: businessId,
      branch_id: branchId,
      supplier_id: supplier.id,
      transaction_type: "opening_balance",
      transaction_date: new Date().toISOString().slice(0, 10),
      reference_type: "supplier_opening_balance",
      reference_number: referenceNumber,
      credit_amount: openingBalance,
      currency: "KES",
      notes: "Opening amount owed to supplier.",
      created_by: userId,
    });
    if (transactionError) throw new Error(transactionError.message);

    await admin.from("supplier_balances").upsert({
      business_id: businessId,
      supplier_id: supplier.id,
      branch_id: branchId,
      currency: "KES",
      opening_balance: openingBalance,
      current_balance: openingBalance,
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id,supplier_id,branch_id,currency" });
  }
}

async function findFinanceAccountId(admin: SupabaseWorkspaceClient, businessId: string, value: string) {
  const account = value.trim();
  if (!account) return null;
  const { data } = await admin
    .from("finance_accounts")
    .select("id")
    .eq("business_id", businessId)
    .or(`account_name.ilike.${account},account_code.ilike.${account}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function postFinanceWorkflow(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const processName = safeText(formData.get("process"), "Cash and Bank");
  const lower = processName.toLowerCase();

  if (lower === "financial accounts") {
    const accountName = getField(formData, "account_name");
    if (!accountName) throw new Error("Enter the financial account name.");
    const accountCode = getField(formData, "account_code") || `FIN-${Date.now().toString().slice(-6)}`;
    const { error } = await admin.from("finance_accounts").insert({
      business_id: businessId,
      branch_id: branchId,
      account_name: accountName,
      account_code: accountCode,
      account_type: slugCode(getField(formData, "account_type"), "cash"),
      currency: getField(formData, "currency") || "KES",
      institution_or_provider: getField(formData, "provider") || null,
      account_number_masked: getField(formData, "masked_account_number") || null,
      minimum_balance: getNumber(formData, "minimum_balance") || null,
      approval_threshold: getNumber(formData, "approval_threshold") || null,
      notes: getField(formData, "responsible_user") || null,
      active: true,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return null;
  }

  if (lower === "expenses") {
    const amount = getNumber(formData, "amount");
    if (amount <= 0) throw new Error("Enter the expense amount.");
    const financeAccountId = await findFinanceAccountId(admin, businessId, getField(formData, "account"));
    const expenseNumber = getField(formData, "expense_number") || `EXP-${Date.now().toString().slice(-8)}`;
    const tax = getNumber(formData, "tax");
    const { error } = await admin.from("expenses").insert({
      business_id: businessId,
      branch_id: branchId,
      expense_number: expenseNumber,
      expense_date: getField(formData, "date") || new Date().toISOString().slice(0, 10),
      expense_category: getField(formData, "category") || "General expense",
      payee: getField(formData, "payee") || "Not specified",
      finance_account_id: financeAccountId,
      amount,
      tax_amount: tax,
      total_paid: amount + tax,
      description: getField(formData, "description") || getField(formData, "attachment") || null,
      approval_status: "approved",
      posted_status: "posted",
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return expenseNumber;
  }

  return null;
}

function accountClassValue(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const allowed = new Set(["assets", "liabilities", "equity", "revenue", "cost_of_sales", "expenses", "other_income", "other_expenses"]);
  return allowed.has(normalized) ? normalized : "expenses";
}

async function postAccountingWorkflow(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const processName = safeText(formData.get("process"), "Accounting");
  const lower = processName.toLowerCase();

  if (lower === "accounting setup wizard") {
    const { error } = await admin.from("accounting_setup_progress").upsert({
      business_id: businessId,
      current_step: "activation_readiness",
      use_recommended_chart: getField(formData, "use_recommended_chart").toLowerCase() !== "no",
      readiness_checks: fieldsPayload(formData),
      saved_payload: fieldsPayload(formData),
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id" });
    if (error) throw new Error(error.message);
    return;
  }

  if (lower === "chart of accounts") {
    const accountCode = getField(formData, "account_code");
    const accountName = getField(formData, "account_name");
    if (!accountCode || !accountName) throw new Error("Enter account code and account name.");
    const accountClass = accountClassValue(getField(formData, "account_class"));
    const { error } = await admin.from("chart_of_accounts").insert({
      business_id: businessId,
      account_code: accountCode,
      account_name: accountName,
      description: getField(formData, "statement_section") || null,
      account_class: accountClass,
      account_type: getField(formData, "account_type") || accountClass,
      account_subtype: getField(formData, "cash_flow_category") || null,
      normal_balance: getField(formData, "normal_balance").toLowerCase().includes("credit") ? "credit" : "debit",
      is_control_account: getField(formData, "control_account").toLowerCase().includes("yes"),
      is_posting_account: !getField(formData, "posting_account").toLowerCase().includes("no"),
      financial_statement_section: getField(formData, "statement_section") || accountClass,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
  }
}

async function postDistributionWorkflow(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId, warehouseId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const processName = safeText(formData.get("process"), "Distribution");
  if (processName.toLowerCase() !== "delivery runs") return null;

  const runNumber = getField(formData, "run_number") || `RUN-${Date.now().toString().slice(-8)}`;
  const { error } = await admin.from("delivery_runs").insert({
    business_id: businessId,
    branch_id: branchId,
    delivery_run_number: runNumber,
    delivery_date: getField(formData, "delivery_date") || new Date().toISOString().slice(0, 10),
    dispatch_warehouse_id: warehouseId,
    return_warehouse_id: warehouseId,
    vehicle_warehouse_id: warehouseId,
    run_type: "scheduled_delivery",
    priority: getField(formData, "priority") || "normal",
    status: "draft",
    approval_status: "draft",
    notes: [
      getField(formData, "route") ? `Route: ${getField(formData, "route")}` : "",
      getField(formData, "vehicle") ? `Vehicle: ${getField(formData, "vehicle")}` : "",
      getField(formData, "primary_driver") ? `Primary driver: ${getField(formData, "primary_driver")}` : "",
    ].filter(Boolean).join("; "),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return runNumber;
}

async function updateBusinessPaymentDetails(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const businessId = await getSettingsBusinessId(admin, fallbackBusinessId);
  const paymentDetails = {
    payment_display_name: getField(formData, "payment_display_name"),
    paybill_number: getField(formData, "paybill_number"),
    paybill_account_number: getField(formData, "paybill_account_number"),
    till_number: getField(formData, "till_number"),
    pochi_la_biashara_phone: getField(formData, "pochi_la_biashara_phone"),
    send_money_phone: getField(formData, "send_money_phone"),
    cheque_payee: getField(formData, "cheque_payee"),
    contact_phone: getField(formData, "contact_phone"),
    whatsapp_number: getField(formData, "whatsapp_number"),
    bank_name: getField(formData, "bank_name"),
    bank_account_name: getField(formData, "bank_account_name"),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  const cleaned = Object.fromEntries(Object.entries(paymentDetails).filter(([, value]) => Boolean(value)));
  const { error } = await admin
    .from("businesses")
    .update({ payment_details: cleaned })
    .eq("id", businessId);
  if (error) throw new Error(error.message);
}

async function updateBusinessProfileDetails(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  void userId;
  const admin = await createSupabaseServerClient();
  const businessId = await getSettingsBusinessId(admin, fallbackBusinessId);
  const legalName = getField(formData, "legal_name");
  const tradingName = getField(formData, "trading_name") || legalName;
  if (!legalName && !tradingName) throw new Error("Enter the business name.");

  const update = {
    legal_name: legalName || tradingName,
    trading_name: tradingName || legalName,
    kra_pin: getField(formData, "kra_pin") || null,
    phone: getField(formData, "phone") || null,
    alternative_phone: getField(formData, "alternative_phone") || null,
    email: getField(formData, "email") || null,
    website: getField(formData, "website") || null,
    physical_address: getField(formData, "physical_address") || null,
    postal_address: getField(formData, "postal_address") || null,
    town: getField(formData, "town") || null,
    county: getField(formData, "county") || null,
    country: getField(formData, "country") || "Kenya",
    invoice_footer: getField(formData, "invoice_footer") || null,
    terms_and_conditions: getField(formData, "terms_and_conditions") || null,
    default_customer_message: getField(formData, "default_customer_message") || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("businesses")
    .update(update)
    .eq("id", businessId);
  if (error) throw new Error(error.message);
}

async function persistWorkflowRecord(
  formData: FormData,
  userId: string,
  businessId: string,
  source?: { table: string; id?: string | null },
  generatedReference?: string,
) {
  const admin = await createSupabaseServerClient();
  const { branchId } = await getWorkspaceContextForClient(admin, userId, businessId);
  const moduleName = safeText(formData.get("module"), "Solva Trade");
  const processName = safeText(formData.get("process"), "Business process");
  const documentName = safeText(formData.get("document"), processName);
  const intent = safeText(formData.get("intent"), "Completed");
  const reference = generatedReference ||
    getField(formData, "document_number") ||
    getField(formData, "reference") ||
    getField(formData, "invoice_number") ||
    getField(formData, "receipt_number") ||
    getField(formData, "grn_number") ||
    getField(formData, "po_number") ||
    getField(formData, "payment_number") ||
    getField(formData, "run_number") ||
    `WRK-${Date.now().toString().slice(-8)}`;

  const { error } = await admin.from("workflow_records").insert({
    business_id: businessId,
    branch_id: branchId,
    module_name: moduleName,
    process_name: processName,
    document_name: documentName,
    intent,
    status: statusFromIntent(intent),
    reference_number: reference,
    record_payload: {
      fields: fieldsPayload(formData),
      returnTo: safeText(formData.get("returnTo"), "/dashboard"),
      next: safeText(formData.get("next"), "Open Dashboard"),
    },
    source_table: source?.table ?? null,
    source_record_id: source?.id ?? null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

async function findUnitId(admin: SupabaseWorkspaceClient, businessId: string, value: string) {
  if (!value) return null;
  const { data } = await admin
    .from("units_of_measure")
    .select("id")
    .or(`business_id.is.null,business_id.eq.${businessId}`)
    .or(`name.ilike.${value},symbol.ilike.${value}`)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findOrCreateCategoryId(admin: SupabaseWorkspaceClient, businessId: string, userId: string, value: string) {
  const name = value.trim();
  if (!name) return null;
  const { data: existing } = await admin
    .from("product_categories")
    .select("id")
    .eq("business_id", businessId)
    .ilike("category_name", name)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await admin
    .from("product_categories")
    .insert({
      business_id: businessId,
      category_name: name,
      category_code: slugCode(name, `cat_${Date.now().toString().slice(-6)}`),
      created_by: userId,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function findOrCreateBrandId(admin: SupabaseWorkspaceClient, businessId: string, userId: string, value: string, manufacturer: string) {
  const name = value.trim();
  if (!name) return null;
  const { data: existing } = await admin
    .from("brands")
    .select("id")
    .eq("business_id", businessId)
    .ilike("brand_name", name)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await admin
    .from("brands")
    .insert({
      business_id: businessId,
      brand_name: name,
      brand_code: slugCode(name, `brand_${Date.now().toString().slice(-6)}`),
      manufacturer_or_owner: manufacturer || null,
      created_by: userId,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function createProductRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const admin = await createSupabaseServerClient();
  const { businessId, branchId, warehouseId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const name = getField(formData, "product_name");
  if (!name) throw new Error("Enter the product name.");
  const productCode = getField(formData, "product_code") || `PRD-${Date.now().toString().slice(-6)}`;
  const productType = productTypeValue(getField(formData, "product_type"));
  const categoryId = await findOrCreateCategoryId(admin, businessId, userId, getField(formData, "category"));
  const brandId = await findOrCreateBrandId(admin, businessId, userId, getField(formData, "brand"), getField(formData, "manufacturer"));
  const baseUnitId = await findUnitId(admin, businessId, getField(formData, "base_stock_unit"));
  const purchaseUnitId = await findUnitId(admin, businessId, getField(formData, "purchase_unit"));
  const sellingUnitId = await findUnitId(admin, businessId, getField(formData, "selling_unit"));
  const tracksStock = !["service", "non_stock_item", "expense_item"].includes(productType) && getBoolean(formData, "track_inventory");
  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
    business_id: businessId,
    product_name: name,
    short_name: getField(formData, "short_name") || null,
    product_code: productCode,
    sku: getField(formData, "sku") || null,
    barcode: getField(formData, "barcode") || null,
    description: getField(formData, "description") || null,
    category_id: categoryId,
    brand_id: brandId,
    manufacturer: getField(formData, "manufacturer") || null,
    base_unit_id: baseUnitId,
    purchase_unit_id: purchaseUnitId,
    selling_unit_id: sellingUnitId,
    product_type: productType,
    track_inventory: tracksStock,
    track_batches: getBoolean(formData, "track_batches"),
    track_expiry: getBoolean(formData, "track_expiry"),
    track_serial_numbers: getBoolean(formData, "track_serial_numbers"),
    track_returnable_packaging: getBoolean(formData, "track_returnable_packaging"),
    tax_category: getField(formData, "tax_category") || null,
    vat_status: getField(formData, "vat_treatment") || "VAT_STD",
    standard_cost: getNumber(formData, "standard_cost") || getNumber(formData, "opening_stock_unit_cost") || null,
    default_selling_price_placeholder: getNumber(formData, "selling_price_placeholder"),
    minimum_selling_price: getNumber(formData, "minimum_selling_price") || null,
    reorder_level: getNumber(formData, "reorder_level"),
    reorder_quantity: getNumber(formData, "reorder_quantity"),
    maximum_stock_level: getNumber(formData, "maximum_stock_level") || null,
    lead_time_days: getNumber(formData, "lead_time_days") || null,
    shelf_life_days: getNumber(formData, "shelf_life_days") || null,
    weight: getNumber(formData, "weight") || null,
    volume: getNumber(formData, "volume") || null,
    image_path: getField(formData, "product_image_url") || null,
    active: getField(formData, "product_status") !== "Inactive",
    created_by: userId,
  })
    .select("id")
    .single();
  if (productError || !product) throw new Error(productError?.message ?? "Could not save the product.");

  const packFactor = getNumber(formData, "units_per_purchase_pack");
  if (purchaseUnitId && baseUnitId && packFactor > 0 && purchaseUnitId !== baseUnitId) {
    const { error: packError } = await admin.from("product_pack_units").insert({
      business_id: businessId,
      product_id: product.id,
      from_unit_id: purchaseUnitId,
      to_unit_id: baseUnitId,
      conversion_factor: packFactor,
      purchase_enabled: true,
      sales_enabled: false,
      barcode: getField(formData, "pack_barcode") || null,
      sku: getField(formData, "pack_sku") || null,
      default_purchase_unit: true,
      default_sales_unit: false,
      created_by: userId,
    });
    if (packError) throw new Error(packError.message);
  }

  const openingQuantity = getNumber(formData, "opening_stock_quantity");
  if (getBoolean(formData, "create_opening_stock_after_save") && tracksStock && openingQuantity > 0) {
    const unitCost = getNumber(formData, "opening_stock_unit_cost") || getNumber(formData, "standard_cost");
    const { error: movementError } = await admin.from("stock_movements").insert({
      business_id: businessId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      product_id: product.id,
      movement_type: "opening_stock",
      direction: "in",
      quantity_base: openingQuantity,
      display_quantity: openingQuantity,
      unit_conversion_factor: 1,
      unit_cost: unitCost,
      total_cost: unitCost * openingQuantity,
      reference_document_type: "product_setup",
      reference_document_id: product.id,
      reference_number: productCode,
      reason: "Opening stock created from product setup",
      created_by: userId,
    });
    if (movementError) throw new Error(movementError.message);
  }
}

async function updateProductRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const productId = safeText(formData.get("recordId"), "");
  if (!productId) throw new Error("Open a product before editing it.");

  const admin = await createSupabaseServerClient();
  const { businessId } = await getWorkspaceContextForClient(admin, userId, fallbackBusinessId);
  const { data: existing } = await admin
    .from("products")
    .select("id, product_code")
    .eq("business_id", businessId)
    .eq("id", productId)
    .maybeSingle();
  if (!existing?.id) throw new Error("That product was not found in this business.");

  const name = getField(formData, "product_name");
  if (!name) throw new Error("Enter the product name.");

  const productType = productTypeValue(getField(formData, "product_type"));
  const categoryId = await findOrCreateCategoryId(admin, businessId, userId, getField(formData, "category"));
  const brandId = await findOrCreateBrandId(admin, businessId, userId, getField(formData, "brand"), getField(formData, "manufacturer"));
  const baseUnitId = await findUnitId(admin, businessId, getField(formData, "base_stock_unit"));
  const purchaseUnitId = await findUnitId(admin, businessId, getField(formData, "purchase_unit"));
  const sellingUnitId = await findUnitId(admin, businessId, getField(formData, "selling_unit"));
  const tracksStock = !["service", "non_stock_item", "expense_item"].includes(productType) && getBoolean(formData, "track_inventory");

  const { error: productError } = await admin
    .from("products")
    .update({
      product_name: name,
      short_name: getField(formData, "short_name") || null,
      product_code: getField(formData, "product_code") || existing.product_code,
      sku: getField(formData, "sku") || null,
      barcode: getField(formData, "barcode") || null,
      description: getField(formData, "description") || null,
      category_id: categoryId,
      brand_id: brandId,
      manufacturer: getField(formData, "manufacturer") || null,
      base_unit_id: baseUnitId,
      purchase_unit_id: purchaseUnitId,
      selling_unit_id: sellingUnitId,
      product_type: productType,
      track_inventory: tracksStock,
      track_batches: getBoolean(formData, "track_batches"),
      track_expiry: getBoolean(formData, "track_expiry"),
      track_serial_numbers: getBoolean(formData, "track_serial_numbers"),
      track_returnable_packaging: getBoolean(formData, "track_returnable_packaging"),
      vat_status: getField(formData, "vat_treatment") || "VAT_STD",
      standard_cost: getNumber(formData, "standard_cost") || null,
      default_selling_price_placeholder: getNumber(formData, "selling_price_placeholder"),
      minimum_selling_price: getNumber(formData, "minimum_selling_price") || null,
      reorder_level: getNumber(formData, "reorder_level"),
      reorder_quantity: getNumber(formData, "reorder_quantity"),
      maximum_stock_level: getNumber(formData, "maximum_stock_level") || null,
      lead_time_days: getNumber(formData, "lead_time_days") || null,
      shelf_life_days: getNumber(formData, "shelf_life_days") || null,
      weight: getNumber(formData, "weight") || null,
      volume: getNumber(formData, "volume") || null,
      image_path: getField(formData, "product_image_url") || null,
      active: getField(formData, "product_status") !== "Inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("id", productId);
  if (productError) throw new Error(productError.message);

  await admin
    .from("product_pack_units")
    .delete()
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .eq("default_purchase_unit", true);

  const packFactor = getNumber(formData, "units_per_purchase_pack");
  if (purchaseUnitId && baseUnitId && packFactor > 0 && purchaseUnitId !== baseUnitId) {
    const { error: packError } = await admin.from("product_pack_units").insert({
      business_id: businessId,
      product_id: productId,
      from_unit_id: purchaseUnitId,
      to_unit_id: baseUnitId,
      conversion_factor: packFactor,
      purchase_enabled: true,
      sales_enabled: false,
      barcode: getField(formData, "pack_barcode") || null,
      sku: getField(formData, "pack_sku") || null,
      default_purchase_unit: true,
      default_sales_unit: false,
      created_by: userId,
    });
    if (packError) throw new Error(packError.message);
  }
}

export async function completeProcessAction(formData: FormData) {
  const moduleName = safeText(formData.get("module"), "Solva Trade");
  const processName = safeText(formData.get("process"), "Business process");
  const documentName = safeText(formData.get("document"), processName);
  const intent = safeText(formData.get("intent"), "Completed");
  const returnTo = safeText(formData.get("returnTo"), "/dashboard");
  const next = safeText(formData.get("next"), "Open Dashboard");

  const params = new URLSearchParams({
    module: moduleName,
    process: processName,
    document: documentName,
    intent,
    returnTo,
    next,
  });
  const usesSavedDocumentExport =
    (moduleName === "Sales" && processName === "Invoices") ||
    (moduleName === "Purchasing" && processName === "Goods Received Notes");
  if (!usesSavedDocumentExport) documentFieldParams(formData).forEach((value, key) => params.append(key, value));
  let generatedReference: string | undefined;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null);

    if (user && businessId) {
      if (intent.toLowerCase().includes("submit") && moduleName === "Sales" && processName === "Invoices") {
        const result = await postSalesInvoice(formData, user.id, businessId);
        generatedReference = result.invoiceNumber;
        params.set("invoiceId", result.invoiceId);
        appendGeneratedDocumentField(params, "invoice_number", "Invoice number", result.invoiceNumber);
        appendGeneratedDocumentField(params, "receipt_number", "Receipt number", result.paymentNumber ?? result.invoiceNumber);
      }
      if (intent.toLowerCase().includes("submit") && moduleName === "Sales" && processName === "Customer Payments") {
        const result = await postCustomerPayment(formData, user.id, businessId);
        generatedReference = result.paymentNumber;
        appendGeneratedDocumentField(params, "payment_number", "Payment number", generatedReference);
        appendGeneratedDocumentField(params, "receipt_number", "Receipt number", generatedReference);
        appendGeneratedDocumentField(params, "amount_received", "Amount received", result.amountReceived.toFixed(2));
        appendGeneratedDocumentField(params, "amount_paid", "Amount paid", result.amountPaid.toFixed(2));
        appendGeneratedDocumentField(params, "total", "Total", result.totalAmount.toFixed(2));
        appendGeneratedDocumentField(params, "balance_due", "Balance due", result.balanceDue.toFixed(2));
        appendGeneratedDocumentField(params, "payment_status", "Payment status", result.balanceDue <= 0 ? "Paid" : "Part paid");
        appendGeneratedDocumentField(params, "payment_date", "Payment date", result.paymentDate);
      }
      if (moduleName === "Purchasing" && processName === "Goods Received Notes" && intent.toLowerCase().includes("posted")) {
        const result = await postGoodsReceived(formData, user.id, businessId);
        generatedReference = result.grnNumber;
        params.set("grnId", result.grnId);
        appendGeneratedDocumentField(params, "grn_number", "GRN number", result.grnNumber);
      }
      if (moduleName === "Customers" && processName === "New Customer") {
        const result = await createCustomerRecord(formData, user.id, businessId);
        generatedReference = result.customerCode;
        params.set("customerId", result.customerId);
        appendGeneratedDocumentField(params, "customer_code", "Customer code", result.customerCode);
        appendGeneratedDocumentField(params, "customer", "Customer", result.customerName);
      }
      if (moduleName === "Customers" && processName === "Edit Customer") {
        const result = await updateCustomerRecord(formData, user.id, businessId);
        generatedReference = result.customerCode;
        params.set("customerId", result.customerId);
        appendGeneratedDocumentField(params, "customer_code", "Customer code", result.customerCode);
        appendGeneratedDocumentField(params, "customer", "Customer", result.customerName);
      }
      if (moduleName === "Suppliers" && processName === "New Supplier") {
        await createSupplierRecord(formData, user.id, businessId);
      }
      if (moduleName === "Inventory" && processName === "New Product") {
        await createProductRecord(formData, user.id, businessId);
      }
      if (moduleName === "Inventory" && processName === "Edit Product") {
        await updateProductRecord(formData, user.id, businessId);
      }
      if (moduleName === "Cash and Bank") {
        generatedReference = (await postFinanceWorkflow(formData, user.id, businessId)) ?? generatedReference;
      }
      if (moduleName === "Accounting") {
        await postAccountingWorkflow(formData, user.id, businessId);
      }
      if (moduleName === "Distribution") {
        generatedReference = (await postDistributionWorkflow(formData, user.id, businessId)) ?? generatedReference;
      }
      if (moduleName === "Settings" && processName === "Payment Methods") {
        await updateBusinessPaymentDetails(formData, user.id, businessId);
      }
      if (moduleName === "Settings" && processName === "Business Profile") {
        await updateBusinessProfileDetails(formData, user.id, businessId);
      }
      if (generatedReference) {
        const reference = generatedReferencePrefix(moduleName, processName, documentName);
        appendGeneratedDocumentField(params, reference.key, reference.label, generatedReference);
      }
      if (!generatedReference) {
        const reference = generateWorkflowReference(moduleName, processName, documentName);
        generatedReference = reference.value;
        appendGeneratedDocumentField(params, reference.key, reference.label, reference.value);
      }
      await persistWorkflowRecord(formData, user.id, businessId, undefined, generatedReference);

      try {
        const admin = createSupabaseAdminClient();
        await admin.from("audit_logs").insert({
          business_id: businessId,
          user_id: user.id,
          action: intent,
          module: moduleName,
          entity_type: documentName,
          new_value: {
            process: processName,
            document: documentName,
            status: "posted",
            source: "workspace_submit",
            fields: Object.fromEntries(documentFieldParams(formData)),
          },
        });
      } catch (auditError) {
        console.warn("Solva Trade audit log skipped", auditError);
      }
    }
  } catch (error) {
    params.set("error", error instanceof Error ? error.message : "The process could not be completed.");
  }

  redirect(`/action-complete?${params.toString()}`);
}
