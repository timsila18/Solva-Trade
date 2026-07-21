"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

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

function getField(formData: FormData, key: string) {
  const value = formData.get(`field_${key}`);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const number = Number(getField(formData, key).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

async function getWorkspaceContext(userId: string, fallbackBusinessId?: string | null) {
  const businessId = (await getActiveBusinessId()) || fallbackBusinessId;
  if (!businessId) throw new Error("No active business was selected.");
  const admin = createSupabaseAdminClient();
  const { data: branch } = await admin
    .from("branches")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!branch?.id) throw new Error("Set up a branch before posting transactions.");

  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true)
    .eq("allow_sales_dispatch", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!warehouse?.id) throw new Error("Set up a sales warehouse before posting transactions.");

  return { admin, businessId, branchId: branch.id as string, warehouseId: warehouse.id as string, userId };
}

async function availableStock(
  admin: ReturnType<typeof createSupabaseAdminClient>,
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
  const { admin, businessId, branchId, warehouseId } = await getWorkspaceContext(userId, fallbackBusinessId);
  const customerId = getField(formData, "customer_id");
  const productId = getField(formData, "product_id");
  const quantity = getNumber(formData, "quantity") || getNumber(formData, "ordered_quantity");
  const unitPrice = getNumber(formData, "unit_price") || getNumber(formData, "price");
  const discount = getNumber(formData, "discount");
  const subtotal = getNumber(formData, "subtotal") || Math.max(0, quantity * unitPrice - discount);
  const tax = getNumber(formData, "tax");
  const total = getNumber(formData, "total") || Math.max(0, subtotal + tax);
  const paid = getNumber(formData, "amount_paid") || getNumber(formData, "amount_received");
  const invoiceNumber = getField(formData, "invoice_number") || `INV-${Date.now().toString().slice(-8)}`;
  const invoiceDate = getField(formData, "invoice_date") || new Date().toISOString().slice(0, 10);
  const dueDate = getField(formData, "due_date") || invoiceDate;

  if (!customerId) throw new Error("Select a saved customer before submitting the sale.");
  if (!productId || quantity <= 0) throw new Error("Select a saved product and enter a quantity before submitting the sale.");

  const { data: product } = await admin
    .from("products")
    .select("track_inventory, product_name, standard_cost")
    .eq("business_id", businessId)
    .eq("id", productId)
    .maybeSingle();
  if (!product) throw new Error("Selected product was not found.");

  if (product.track_inventory) {
    const available = await availableStock(admin, businessId, branchId, warehouseId, productId);
    if (available < quantity) throw new Error(`Insufficient stock for ${product.product_name}. Available: ${available}.`);
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

  const { error: itemError } = await admin.from("sales_invoice_items").insert({
    business_id: businessId,
    invoice_id: invoice.id,
    product_id: productId,
    invoice_quantity: quantity,
    delivered_quantity: quantity,
    base_quantity: quantity,
    unit_price: unitPrice,
    tax_amount: tax,
    line_total: total,
  });
  if (itemError) throw new Error(itemError.message);

  if (product.track_inventory) {
    const unitCost = Number(product.standard_cost ?? 0);
    const { error: movementError } = await admin.from("stock_movements").insert({
      business_id: businessId,
      branch_id: branchId,
      warehouse_id: warehouseId,
      product_id: productId,
      movement_type: "sale",
      direction: "out",
      quantity_base: quantity,
      display_quantity: quantity,
      unit_conversion_factor: 1,
      unit_cost: unitCost,
      total_cost: unitCost * quantity,
      reference_document_type: "sales_invoice",
      reference_document_id: invoice.id,
      reference_number: invoiceNumber,
      reason: "Sale submitted from Solva Trade workflow",
      created_by: userId,
    });
    if (movementError) throw new Error(movementError.message);
  }

  if (paid > 0) {
    await postCustomerPayment(formData, userId, fallbackBusinessId, invoice.id, paid);
  }
}

async function postCustomerPayment(
  formData: FormData,
  userId: string,
  fallbackBusinessId?: string | null,
  invoiceIdOverride?: string,
  amountOverride?: number,
) {
  const { admin, businessId, branchId } = await getWorkspaceContext(userId, fallbackBusinessId);
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
}

async function createCustomerRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const { admin, businessId, branchId } = await getWorkspaceContext(userId, fallbackBusinessId);
  const name = getField(formData, "customer_name");
  if (!name) throw new Error("Enter the customer name.");
  const code = `CUS-${Date.now().toString().slice(-6)}`;
  await admin.from("customers").insert({
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
  });
}

async function createProductRecord(formData: FormData, userId: string, fallbackBusinessId?: string | null) {
  const { admin, businessId } = await getWorkspaceContext(userId, fallbackBusinessId);
  const name = getField(formData, "product_name");
  if (!name) throw new Error("Enter the product name.");
  const productCode = getField(formData, "product_code") || `PRD-${Date.now().toString().slice(-6)}`;
  await admin.from("products").insert({
    business_id: businessId,
    product_name: name,
    short_name: getField(formData, "short_name") || null,
    product_code: productCode,
    sku: getField(formData, "sku") || null,
    barcode: getField(formData, "barcode") || null,
    manufacturer: getField(formData, "manufacturer") || null,
    product_type: "stock_item",
    track_inventory: true,
    vat_status: getField(formData, "vat_treatment") || "VAT_STD",
    default_selling_price_placeholder: getNumber(formData, "selling_price_placeholder"),
    reorder_level: getNumber(formData, "reorder_level"),
    created_by: userId,
  });
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
  documentFieldParams(formData).forEach((value, key) => params.append(key, value));

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null);

    if (user && businessId) {
      if (intent.toLowerCase().includes("submit") && moduleName === "Sales" && processName === "Invoices") {
        await postSalesInvoice(formData, user.id, businessId);
      }
      if (intent.toLowerCase().includes("submit") && moduleName === "Sales" && processName === "Customer Payments") {
        await postCustomerPayment(formData, user.id, businessId);
      }
      if (moduleName === "Customers" && processName === "New Customer") {
        await createCustomerRecord(formData, user.id, businessId);
      }
      if (moduleName === "Inventory" && processName === "New Product") {
        await createProductRecord(formData, user.id, businessId);
      }

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
    }
  } catch (error) {
    params.set("error", error instanceof Error ? error.message : "The process could not be completed.");
  }

  redirect(`/action-complete?${params.toString()}`);
}
