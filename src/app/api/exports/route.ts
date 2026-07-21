import { NextRequest } from "next/server";
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
  kraPin: string;
  generatedBy: string;
  generatedAt: string;
  transaction: Record<string, string>;
  lines: ReportLine[];
  totals: Record<string, string>;
  approvals: Record<string, string>;
  auditTrail: string[];
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

function reportLineFromFields(fields: Record<string, { label: string; value: string }>): ReportLine[] {
  if (Object.keys(fields).length === 0) return [];
  const quantity = parseAmount(fieldValue(fields, ["quantity", "ordered_quantity", "received_quantity", "accepted_quantity", "return_quantity", "quantity_sold"], "1"));
  const unitPrice = parseAmount(fieldValue(fields, ["unit_price", "price", "unit_cost", "rate"], "0"));
  const discount = parseAmount(fieldValue(fields, ["discount"], "0"));
  const taxAmount = parseAmount(fieldValue(fields, ["tax", "withholding_tax"], "0"));
  const explicitTotal = parseAmount(fieldValue(fields, ["total", "amount", "balance_due", "amount_received", "amount_sent"], "0"));
  const subtotal = parseAmount(fieldValue(fields, ["subtotal"], "0")) || quantity * unitPrice;
  const lineTotal = explicitTotal || Math.max(0, subtotal - discount + taxAmount);
  return [
    {
      sku: fieldValue(fields, ["product", "sku", "item", "vehicle_stock_item", "account", "report"], "Entered item"),
      description: fieldValue(fields, ["description", "product", "reason", "purpose", "category", "report"], "Submitted transaction line"),
      unit: fieldValue(fields, ["unit"], "Each"),
      quantity: quantity || 1,
      unitPrice,
      discount,
      taxRate: taxAmount ? "Tax entered" : "No tax entered",
      taxAmount,
      lineTotal,
      warehouse: fieldValue(fields, ["warehouse", "branch", "route", "account"], "Selected workspace"),
      batch: fieldValue(fields, ["batch", "reference", "po_number", "invoice", "document_number"], "Not provided"),
      notes: "Generated from submitted form values.",
    },
  ];
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

async function tenantContext() {
  const fallback = {
    businessName: "Your company",
    businessLogoPath: null as string | null,
    businessPhone: "",
    businessEmail: "",
    businessLocation: "Kenya",
    kraPin: "",
    generatedBy: "Solva Trade User",
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
    const metadataBusinessName = typeof user.app_metadata?.business_name === "string" ? user.app_metadata.business_name : fallback.businessName;
    const metadataKraPin = typeof user.app_metadata?.business_kra_pin === "string" ? user.app_metadata.business_kra_pin : "";
    const metadataPhone = typeof user.app_metadata?.business_phone === "string" ? user.app_metadata.business_phone : "";
    const metadataEmail = typeof user.app_metadata?.business_email === "string" ? user.app_metadata.business_email : "";
    const metadataLocation = typeof user.app_metadata?.business_location === "string" ? user.app_metadata.business_location : fallback.businessLocation;
    const { data: membership } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const businessId = membership?.business_id ?? metadataBusinessId;
    const metadataTenant = {
      businessName: metadataBusinessName,
      businessLogoPath: null,
      businessPhone: metadataPhone,
      businessEmail: metadataEmail,
      businessLocation: metadataLocation,
      kraPin: metadataKraPin,
      generatedBy,
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
        }
      | null = null;

    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("businesses")
        .select("trading_name, legal_name, logo_path, phone, email, physical_address, county, country, kra_pin")
        .eq("id", businessId)
        .maybeSingle();
      business = data;
    } catch {
      const { data } = await supabase
        .from("businesses")
        .select("trading_name, legal_name, logo_path, phone, email, physical_address, county, country, kra_pin")
        .eq("id", businessId)
        .maybeSingle();
      business = data;
    }

    if (!business) return { ...fallback, ...metadataTenant };
    const businessLogoPath = await signedBusinessLogoPath(business.logo_path);

    return {
      businessName: business.trading_name ?? business.legal_name ?? fallback.businessName,
      businessLogoPath,
      businessPhone: business.phone ?? metadataPhone,
      businessEmail: business.email ?? metadataEmail,
      businessLocation: [business.physical_address, business.county, business.country].filter(Boolean).join(", ") || metadataLocation,
      kraPin: business.kra_pin ?? metadataKraPin,
      generatedBy,
    };
  } catch {
    return fallback;
  }
}

async function buildReport(searchParams: URLSearchParams): Promise<Report> {
  const tenant = await tenantContext();
  const moduleName = searchParams.get("module") ?? "Solva Trade";
  const processName = searchParams.get("process") ?? "Business Process";
  const fields = submittedFields(searchParams);
  const partyName =
    searchParams.get("customer") ??
    searchParams.get("company") ??
    searchParams.get("user") ??
    searchParams.get("party") ??
    fieldValue(fields, ["customer", "supplier", "received_from", "paid_to", "payee", "owner", "driver", "employee"], tenant.businessName);
  const generatedBy = searchParams.get("generatedBy") ?? searchParams.get("printer") ?? tenant.generatedBy;
  const lines = reportLineFromFields(fields);
  const subtotal =
    parseAmount(fieldValue(fields, ["subtotal"], "0")) ||
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount, 0);
  const tax = parseAmount(fieldValue(fields, ["tax"], "0")) || lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const discount = parseAmount(fieldValue(fields, ["discount"], "0")) || lines.reduce((sum, line) => sum + line.discount, 0);
  const total =
    parseAmount(fieldValue(fields, ["total", "amount", "amount_received", "amount_sent"], "0")) ||
    lines.reduce((sum, line) => sum + line.lineTotal, 0) ||
    Math.max(0, subtotal - discount + tax);
  const balanceDue = parseAmount(fieldValue(fields, ["balance_due", "outstanding_amount"], "0")) || total;
  const reference =
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
  const documentDate = fieldValue(fields, ["invoice_date", "receipt_date", "payment_date", "received_date", "date", "delivery_date", "needed_by", "as_of_date"], todayIsoDate());
  const dueDate = fieldValue(fields, ["due_date", "valid_until", "expected_date", "expiry_date", "expected_arrival"], documentDate);

  return {
    moduleName,
    processName,
    partyName,
    businessName: tenant.businessName,
    businessLogoPath: tenant.businessLogoPath,
    businessPhone: tenant.businessPhone,
    businessEmail: tenant.businessEmail,
    businessLocation: tenant.businessLocation,
    kraPin: tenant.kraPin,
    generatedBy,
    generatedAt: generatedAt(),
    transaction: {
      "Report owner": partyName,
      Business: tenant.businessName,
      "KRA PIN": tenant.kraPin || "Not provided",
      "Reference number": reference,
      "Document date": documentDate,
      "Due or action date": dueDate,
      Branch: fieldValue(fields, ["branch", "dispatch_warehouse", "warehouse", "route"], "Main workspace"),
      Currency: "KES",
      "Payment terms": fieldValue(fields, ["payment_terms", "payment_status", "payment_method", "delivery_terms"], "As entered"),
      "Process status": "Ready for review",
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
      "Balance due": money(balanceDue),
    },
    approvals: {
      Prepared: generatedBy,
      Reviewed: "Pending manager review",
      Approved: "Pending owner approval where required",
      "Audit status": "Tenant scoped and export logged",
    },
    auditTrail: [
      "Created from the selected Solva Trade process.",
      "Includes header details, line details, totals, approval state, and audit context.",
      "CSV output protects spreadsheet users from formula injection.",
      lines.length ? "Document values come from the submitted workflow fields." : "No posted transaction rows were found for the selected filters.",
      "Company logos are included when the business profile provides one; Solva Trade branding and watermark remain on every report.",
    ],
  };
}

function csv(report: Report) {
  const detailHeaders = [
    "module",
    "process",
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
  ];
  const auditNotes = report.auditTrail.join(" | ");
  const rows = report.lines.map((line) => [
    report.moduleName,
    report.processName,
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

function lineHeaders(report: Report) {
  return blueprintFor(report).headers;
}

function valueForHeader(report: Report, line: ReportLine, index: number, header: string) {
  const h = header.toLowerCase();
  if (h === "#" || h.includes("s/no") || h.includes("line") || h.includes("stop")) return String(index + 1);
  if (h.includes("timestamp")) return report.generatedAt;
  if (h.includes("date") || h.includes("period") || h.includes("needed by") || h.includes("expiry")) return report.transaction["Document date"];
  if (h.includes("document") || h.includes("reference") || h.includes("ref") || h.includes("invoice") || h.includes("po") || h.includes("voucher") || h.includes("receipt") || h.includes("req")) return report.transaction["Reference number"];
  if (h.includes("customer") || h.includes("supplier") || h.includes("party") || h.includes("payee") || h.includes("source") || h.includes("received from") || h.includes("recipient")) return report.partyName;
  if (h.includes("description") || h.includes("particular") || h.includes("item") || h.includes("product") || h.includes("specification") || h.includes("account name") || h.includes("activity")) return line.description;
  if (h.includes("sku") || h.includes("code") || h.includes("account code")) return line.sku;
  if (h.includes("unit") && !h.includes("price")) return line.unit;
  if (h.includes("ordered")) return String(line.quantity);
  if (h.includes("delivered") || h.includes("received") || h.includes("accepted") || h.includes("loaded") || h.includes("picked") || h.includes("counted") || h.includes("sent")) return String(line.quantity);
  if (h.includes("returned") || h.includes("rejected") || h.includes("variance") || h.includes("backorder")) return "0";
  if (h.includes("outstanding") || h.includes("running balance") || h === "balance" || h.includes("closing")) return money(line.lineTotal);
  if (h.includes("qty") || h.includes("quantity") || h.includes("on hand")) return String(line.quantity);
  if (h.includes("price") || h.includes("rate") || h.includes("cost")) return money(line.unitPrice);
  if (h.includes("discount")) return money(line.discount);
  if (h.includes("tax") || h.includes("vat")) return h.includes("rate") ? line.taxRate : money(line.taxAmount);
  if (h.includes("money out") || h.includes("credit") || h.includes("paid")) return money(line.discount);
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
    return `
      <section class="receipt-confirmation">
        <div>
          <p class="overline">Amount received</p>
          <strong>${htmlEscape(report.totals.Total)}</strong>
          <span>${htmlEscape(blueprint.footerNote)}</span>
        </div>
        <div class="receipt-number">
          <span>Receipt No.</span>
          <strong>${htmlEscape(report.transaction["Reference number"])}</strong>
        </div>
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
    return `<section class="receipt-slip"><div><strong>Sales Receipt Slip</strong><span>${htmlEscape(report.partyName)}</span></div><div><strong>Amount Received</strong><span>${htmlEscape(report.totals.Total)}</span></div></section>`;
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

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(report.processName)} - ${htmlEscape(report.businessName)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eaf1f8; color: ${brand.navy}; font-family: Arial, Helvetica, sans-serif; }
    .page { position: relative; max-width: 920px; min-height: 1180px; margin: ${print ? "0" : "24px auto"}; overflow: hidden; background: white; padding: 42px 48px 36px; box-shadow: ${print ? "none" : "0 18px 60px rgba(7,26,43,.12)"}; }
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
    .statement-summary, .report-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    .report-kpis { grid-template-columns: repeat(3, 1fr); }
    .statement-summary div, .report-kpis div { border-radius: 8px; background: var(--doc-soft); padding: 13px; }
    .statement-summary span, .report-kpis span { display: block; color: ${brand.muted}; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .statement-summary strong, .report-kpis strong { display: block; margin-top: 5px; color: ${brand.blue}; font-size: 17px; }
    .report-kpis small { display: block; margin-top: 4px; color: ${brand.slate}; line-height: 1.4; }
    .reason-box, .terms, .pod-box, .receipt-slip { margin-top: 18px; border: 1px solid ${brand.border}; border-radius: 8px; background: ${brand.soft}; padding: 14px; }
    .receipt-slip { display: grid; grid-template-columns: 1fr 220px; border-style: dashed; }
    .receipt-slip strong, .receipt-slip span, .pod-box strong, .pod-box span { display: block; }
    .terms ol { margin: 0; padding-left: 18px; color: ${brand.slate}; font-size: 11px; line-height: 1.6; }
    .table-wrap { position: relative; margin-top: 26px; border: 1px solid ${brand.border}; border-radius: 10px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    caption { padding: 10px 12px; background: #f8fafc; color: ${brand.slate}; font-size: 11px; font-weight: 800; text-align: left; text-transform: uppercase; }
    th { background: var(--doc-accent); color: white; font-size: 11px; padding: 10px 8px; text-align: left; }
    td { border-top: 1px solid ${brand.border}; color: ${brand.navy}; font-size: 11px; line-height: 1.35; padding: 10px 8px; vertical-align: top; word-break: break-word; }
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
        <h3>Approval and Audit</h3>
        <dl class="details">${approvalRows}</dl>
        <ul>${report.auditTrail.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
      </article>
      <article class="totals">
        <table>${totalRows}</table>
      </article>
    </section>

    <section class="signatures">
      ${style.signatures.map((label) => `<div class="signature">${htmlEscape(label)}</div>`).join("")}
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

  wrap(value: string, x: number, y: number, width: number, size = 10, color = "navy", bold = false, leading = size + 4) {
    const maxChars = Math.max(8, Math.floor(width / (size * 0.52)));
    const words = value.split(/\s+/);
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
    rows.slice(0, 5).forEach((row, index) => this.text(row, x, y - index * leading, size, color, bold));
    return y - Math.min(rows.length, 5) * leading;
  }

  output() {
    return this.ops.join("\n");
  }
}

function renderPdfTable(canvas: PdfCanvas, report: Report, startY: number) {
  const headers = lineHeaders(report);
  const rows = report.lines.map((line, index) => lineCells(report, line, index));
  const x = 48;
  const widths =
    headers.length === 8
      ? [30, 96, 72, 46, 58, 68, 66, 94]
      : headers.length === 7
        ? [54, 116, 74, 62, 62, 72, 90]
        : headers.length === 6
          ? [62, 178, 54, 78, 70, 88]
          : headers.length === 5
            ? [156, 58, 92, 78, 146]
            : [62, 220, 44, 76, 58, 70];
  let y = startY;

  canvas.rect(x, y - 18, 530, 22, "navy");
  let cursor = x;
  headers.forEach((header, index) => {
    canvas.text(header, cursor + 5, y - 10, 7.5, "white", true);
    cursor += widths[index] ?? 70;
  });
  y -= 24;

  if (rows.length === 0) {
    canvas.rect(x, y - 32, 530, 38, "soft");
    canvas.text("No posted records found for the selected filters.", x + 150, y - 10, 8.5, "muted");
    return y - 48;
  }

  rows.forEach((row, rowIndex) => {
    const height = 38;
    canvas.rect(x, y - height + 6, 530, height, rowIndex % 2 === 0 ? "white" : "soft");
    canvas.line(x, y + 6, x + 530, y + 6);
    cursor = x;
    row.forEach((cell, index) => {
      canvas.wrap(cell, cursor + 5, y - 8, (widths[index] ?? 70) - 10, 7.5, "navy", false, 9);
      cursor += widths[index] ?? 70;
    });
    y -= height;
  });

  canvas.line(x, y + 6, x + 530, y + 6, "border");
  return y - 16;
}

function pdf(report: Report) {
  const canvas = new PdfCanvas();
  const title = titleFor(report);
  const template = templateFor(report);
  const style = blueprintFor(report);

  canvas.rect(0, 0, 612, 842, "white");
  canvas.rect(0, 832, 612, 10, "blue");
  canvas.rect(204, 832, 204, 10, "cyan");
  canvas.rect(408, 832, 204, 10, "gold");
  canvas.text("SOLVA TRADE", 92, 420, 72, "watermark", true);

  canvas.rect(48, 744, 72, 72, "surface");
  canvas.rect(52, 748, 64, 64, "white");
  canvas.text(initials(report.businessName), 68, 778, 22, "blue", true);
  canvas.text(report.businessName, 134, 794, 20, "navy", true);
  canvas.wrap(report.businessLocation, 134, 774, 240, 8.5, "slate");
  if (report.businessPhone) canvas.text(`Phone: ${report.businessPhone}`, 134, 750, 8.5, "slate");
  if (report.businessEmail) canvas.text(`Email: ${report.businessEmail}`, 134, 738, 8.5, "slate");
  if (report.kraPin) canvas.text(`KRA PIN: ${report.kraPin}`, 134, 726, 8.5, "slate");

  canvas.wrap(title, 372, 792, 190, 17, "navy", true, 20);
  canvas.text(style.label, 374, 746, 8, "blue", true);
  canvas.text(`# ${report.transaction["Reference number"]}`, 374, 732, 8.5, "muted");
  canvas.text(`Generated: ${report.generatedAt}`, 374, 718, 7.5, "muted");

  let tableStart = 572;
  if (template === "salesReceipt") {
    canvas.rect(48, 634, 516, 66, "navy");
    canvas.text("AMOUNT RECEIVED", 66, 674, 9, "cyan", true);
    canvas.text(report.totals.Total, 66, 650, 24, "white", true);
    canvas.text(`Receipt No. ${report.transaction["Reference number"]}`, 374, 666, 10, "white", true);
    canvas.text(`Received from ${report.partyName}`, 374, 648, 8.5, "white");
    canvas.text("PAYMENT LINE ITEMS", 48, 604, 11, "blue", true);
    tableStart = 582;
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

  const totalsY = Math.max(180, yAfterTable);
  canvas.text("TOTALS", 384, totalsY, 11, "blue", true);
  Object.entries(report.totals).forEach(([label, value], index, all) => {
    const y = totalsY - 22 - index * 22;
    canvas.rect(384, y - 4, 174, 20, index === all.length - 1 ? "surface" : "white");
    canvas.text(label, 394, y + 2, 8.5, index === all.length - 1 ? "blue" : "slate", index === all.length - 1);
    canvas.text(value, 480, y + 2, 8.5, index === all.length - 1 ? "blue" : "navy", true);
  });

  canvas.text("APPROVAL AND AUDIT", 48, totalsY, 11, "blue", true);
  Object.entries(report.approvals).forEach(([label, value], index) => {
    canvas.text(`${label}:`, 48, totalsY - 22 - index * 18, 8, "muted", true);
    canvas.wrap(value, 112, totalsY - 22 - index * 18, 210, 8, "navy");
  });

  const signatureLabels = style.signatures.slice(0, 3);
  [48, 242, 436].forEach((x, index) => {
    canvas.line(x, 96, x + 128, 96, "navy");
    canvas.wrap(signatureLabels[index] ?? "Approved by", x + 16, 82, 104, 8, "slate");
  });
  if (template === "salesReceipt") {
    canvas.rect(48, 116, 516, 30, "soft");
    canvas.text("SALES RECEIPT SLIP", 62, 130, 8, "blue", true);
    canvas.text(`Amount received: ${report.totals.Total}`, 394, 130, 8, "navy", true);
  }
  canvas.line(48, 58, 564, 58, "border");
  canvas.wrap(`${report.businessName} document generated by Solva Trade. ${style.footerNote} Printed by ${report.generatedBy} on ${report.generatedAt}.`, 76, 42, 460, 7.5, "muted");

  const content = canvas.output();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return document;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const report = await buildReport(searchParams);
  const format = searchParams.get("format") ?? "csv";
  const filename = slug(`${report.moduleName}-${report.processName}`);

  if (format === "json") {
    return Response.json(report);
  }

  if (format === "pdf") {
    return new Response(pdf(report), {
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
