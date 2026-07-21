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

type DocumentFamily = "sales" | "purchase" | "inventory" | "distribution" | "finance" | "tax" | "statement" | "report";
type DocumentTemplate = "receipt" | "invoice" | "grn" | "purchaseOrder" | "statement" | "delivery" | "note" | "report" | "finance" | "inventory";

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

const defaultLines: ReportLine[] = [
  {
    sku: "SKU-001",
    description: "Primary transaction item or service",
    unit: "Each",
    quantity: 2,
    unitPrice: 1250,
    discount: 0,
    taxRate: "VAT 16%",
    taxAmount: 400,
    lineTotal: 2900,
    warehouse: "Main Stock",
    batch: "Batch-001",
    notes: "Captured as part of the selected process.",
  },
  {
    sku: "SKU-002",
    description: "Supporting charge, fee, item, or process detail",
    unit: "Each",
    quantity: 1,
    unitPrice: 750,
    discount: 50,
    taxRate: "VAT 16%",
    taxAmount: 112,
    lineTotal: 812,
    warehouse: "Nairobi Depot",
    batch: "Not batch tracked",
    notes: "Included so exports carry every useful transaction detail.",
  },
  {
    sku: "SKU-003",
    description: "Delivery, receiving, approval or audit reference",
    unit: "Service",
    quantity: 1,
    unitPrice: 350,
    discount: 0,
    taxRate: "VAT 16%",
    taxAmount: 56,
    lineTotal: 406,
    warehouse: "Dispatch",
    batch: "Reference",
    notes: "Keeps operational documents useful after download.",
  },
];

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "ST";
}

function familyFor(report: Pick<Report, "moduleName" | "processName">): DocumentFamily {
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  if (value.includes("statement") || value.includes("aging") || value.includes("ageing")) return "statement";
  if (value.includes("purchase") || value.includes("supplier") || value.includes("received") || value.includes("grn") || value.includes("rfq")) return "purchase";
  if (value.includes("inventory") || value.includes("stock") || value.includes("warehouse") || value.includes("bin card")) return "inventory";
  if (value.includes("delivery") || value.includes("dispatch") || value.includes("route") || value.includes("vehicle") || value.includes("driver")) return "distribution";
  if (value.includes("cash") || value.includes("ledger") || value.includes("voucher") || value.includes("balance sheet") || value.includes("income statement")) return "finance";
  if (value.includes("vat") || value.includes("tax") || value.includes("etims") || value.includes("withholding")) return "tax";
  if (value.includes("report") || value.includes("brief") || value.includes("dashboard") || value.includes("action plan")) return "report";
  return "sales";
}

function titleFor(report: Report) {
  return report.processName.toUpperCase();
}

function templateFor(report: Report): DocumentTemplate {
  const value = `${report.moduleName} ${report.processName}`.toLowerCase();
  if (value.includes("sales receipt") || value.includes("receipt voucher") || value.includes("payment receipt")) return "receipt";
  if (value.includes("goods received") || value.includes("grn")) return "grn";
  if (value.includes("purchase order") || value.includes("purchase requisition") || value.includes("request for quotation") || value.includes("rfq")) return "purchaseOrder";
  if (value.includes("statement") || value.includes("aging") || value.includes("ageing")) return "statement";
  if (value.includes("delivery") || value.includes("dispatch") || value.includes("route") || value.includes("vehicle") || value.includes("pod")) return "delivery";
  if (value.includes("credit note") || value.includes("debit note") || value.includes("return note")) return "note";
  if (value.includes("cashbook") || value.includes("ledger") || value.includes("voucher") || value.includes("trial balance") || value.includes("balance sheet") || value.includes("income statement")) return "finance";
  if (value.includes("stock") || value.includes("inventory") || value.includes("bin card") || value.includes("valuation") || value.includes("reorder")) return "inventory";
  if (value.includes("report") || value.includes("brief") || value.includes("dashboard") || value.includes("action plan")) return "report";
  return "invoice";
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

    return {
      businessName: business.trading_name ?? business.legal_name ?? fallback.businessName,
      businessLogoPath: business.logo_path ?? null,
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
  const partyName =
    searchParams.get("customer") ??
    searchParams.get("company") ??
    searchParams.get("user") ??
    searchParams.get("party") ??
    tenant.businessName;
  const generatedBy = searchParams.get("generatedBy") ?? searchParams.get("printer") ?? tenant.generatedBy;
  const subtotal = defaultLines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount, 0);
  const tax = defaultLines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = defaultLines.reduce((sum, line) => sum + line.lineTotal, 0);

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
      "Reference number": `${moduleName.slice(0, 3).toUpperCase()}-${processName.slice(0, 3).toUpperCase()}-0001`,
      "Document date": "2026-07-21",
      "Due or action date": "2026-07-28",
      Branch: "Nairobi Depot",
      Currency: "KES",
      "Payment terms": "Net 7",
      "Process status": "Ready for review",
      "Source workspace": moduleName,
      "Business process": processName,
    },
    lines: defaultLines,
    totals: {
      Subtotal: money(subtotal),
      Discount: money(defaultLines.reduce((sum, line) => sum + line.discount, 0)),
      Tax: money(tax),
      Total: money(total),
      "Balance due": money(total),
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
      "Live deployments replace these template rows with posted tenant records.",
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
  return `<span>${htmlEscape(initials(report.businessName))}</span>`;
}

function lineHeaders(report: Report) {
  const family = familyFor(report);
  if (family === "purchase") return ["#", "Description", "Item Code", "Units", "Qty Received", "Qty Returned", "Total Qty"];
  if (family === "distribution") return ["#", "Description", "Vehicle/Route", "Ordered", "Delivered", "Outstanding"];
  if (family === "statement") return ["Date", "Reference", "Description", "Debit", "Credit", "Balance"];
  if (family === "report") return ["Area", "Metric", "Current", "Risk", "Recommended Action"];
  if (family === "inventory") return ["SKU", "Description", "Unit", "Qty", "Warehouse", "Batch", "Status"];
  return ["Code", "Description", "Qty", "Unit Price", "Tax", "Amount"];
}

function lineCells(report: Report, line: ReportLine, index: number) {
  const family = familyFor(report);
  if (family === "purchase") return [String(index + 1), line.description, line.sku, line.unit, String(line.quantity), "0", String(line.quantity)];
  if (family === "distribution") return [String(index + 1), line.description, line.warehouse, String(line.quantity), String(line.quantity), "0"];
  if (family === "statement") return [report.transaction["Document date"], line.sku, line.description, money(line.lineTotal), money(line.discount), money(line.lineTotal)];
  if (family === "report") return [line.sku, line.description, money(line.lineTotal), line.taxRate, line.notes];
  if (family === "inventory") return [line.sku, line.description, line.unit, String(line.quantity), line.warehouse, line.batch, line.notes];
  return [line.sku, line.description, String(line.quantity), money(line.unitPrice), money(line.taxAmount), money(line.lineTotal)];
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

function templateIntro(report: Report, transactionRows: string) {
  const template = templateFor(report);
  if (template === "receipt") {
    return `
      <section class="receipt-confirmation">
        <div>
          <p class="overline">Amount received</p>
          <strong>${htmlEscape(report.totals.Total)}</strong>
          <span>Paid by cash, bank, M-Pesa, cheque or mixed tender as recorded.</span>
        </div>
        <div class="receipt-number">
          <span>Receipt No.</span>
          <strong>${htmlEscape(report.transaction["Reference number"])}</strong>
        </div>
      </section>
      <section class="two-column">
        <article class="box"><h3>Received From</h3><p class="party">${htmlEscape(report.partyName)}</p><p>${htmlEscape(report.transaction.Branch)}</p></article>
        <article class="box"><h3>Payment Details</h3>${documentMetaCard(report)}</article>
      </section>
    `;
  }

  if (template === "grn") {
    return `
      <section class="grn-grid">
        <article class="box"><h3>Party Details</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Supplier delivery received into ${htmlEscape(report.transaction.Branch)}.</p></article>
        <article class="box"><h3>GRN Details</h3>${documentMetaCard(report)}<p class="small-note">Record accepted, rejected and returned quantities before stock is posted.</p></article>
      </section>
    `;
  }

  if (template === "purchaseOrder") {
    return `
      <section class="po-grid">
        <article class="box dark"><h3>Vendor</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Supplier quotation, tax and delivery details verified before order.</p></article>
        <article class="box"><h3>Ship To</h3><p class="party">${htmlEscape(report.businessName)}</p><p>${htmlEscape(report.businessLocation)}</p></article>
        <article class="box"><h3>P.O Details</h3>${documentMetaCard(report)}</article>
      </section>
    `;
  }

  if (template === "statement") {
    return `
      <section class="statement-summary">
        <div><span>Opening balance</span><strong>KES 0.00</strong></div>
        <div><span>Invoices / Debits</span><strong>${htmlEscape(report.totals.Subtotal)}</strong></div>
        <div><span>Payments / Credits</span><strong>${htmlEscape(report.totals.Discount)}</strong></div>
        <div><span>Closing balance</span><strong>${htmlEscape(report.totals["Balance due"])}</strong></div>
      </section>
      <section class="two-column">
        <article class="box"><h3>Account Holder</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Statement period and ageing summary.</p></article>
        <article class="box"><h3>Statement Details</h3>${documentMetaCard(report)}</article>
      </section>
    `;
  }

  if (template === "delivery") {
    return `
      <section class="two-column">
        <article class="box"><h3>Deliver To</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Delivery address, route, vehicle and driver details.</p></article>
        <article class="box"><h3>Dispatch Details</h3>${documentMetaCard(report)}<p class="small-note">Customer signs proof of delivery after quantities are verified.</p></article>
      </section>
    `;
  }

  if (template === "note") {
    return `
      <section class="two-column">
        <article class="box"><h3>Adjustment To</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Original invoice, return reason and approval evidence.</p></article>
        <article class="box"><h3>Credit / Debit Details</h3>${documentMetaCard(report)}</article>
      </section>
      <section class="reason-box"><h3>Reason for Adjustment</h3><p>Price correction, returned goods, damaged stock, tax adjustment or approved commercial correction.</p></section>
    `;
  }

  if (template === "finance") {
    return `
      <section class="statement-summary finance-summary">
        <div><span>Money In</span><strong>${htmlEscape(report.totals.Total)}</strong></div>
        <div><span>Money Out</span><strong>${htmlEscape(report.totals.Discount)}</strong></div>
        <div><span>Tax</span><strong>${htmlEscape(report.totals.Tax)}</strong></div>
        <div><span>Net Position</span><strong>${htmlEscape(report.totals["Balance due"])}</strong></div>
      </section>
      <section class="two-column"><article class="box"><h3>Account Details</h3><dl class="details">${transactionRows}</dl></article><article class="box"><h3>Control Notes</h3><p>Prepared for cashbook, ledger, voucher, reconciliation and audit review.</p></article></section>
    `;
  }

  if (template === "report" || template === "inventory") {
    return `
      <section class="report-kpis">
        <div><span>Business Health</span><strong>Ready</strong><small>Monitor daily</small></div>
        <div><span>Cash / Value</span><strong>${htmlEscape(report.totals.Total)}</strong><small>From posted records</small></div>
        <div><span>Risk</span><strong>Review</strong><small>Owner action required where flagged</small></div>
      </section>
      <section class="reason-box"><h3>Management Commentary</h3><p>This report explains the result, the risk, the owner action and the supporting transaction detail.</p></section>
    `;
  }

  return `
    <section class="invoice-grid">
      <article class="box"><h3>Bill To</h3><p class="party">${htmlEscape(report.partyName)}</p><p>Customer account, PIN, address and credit terms.</p></article>
      <article class="box"><h3>Ship / Supply To</h3><p class="party">${htmlEscape(report.transaction.Branch)}</p><p>Place of supply, delivery route and fulfilment details.</p></article>
      <article class="box"><h3>Invoice Details</h3>${documentMetaCard(report)}</article>
    </section>
  `;
}

function templateOutro(report: Report) {
  const template = templateFor(report);
  if (template === "receipt") {
    return `<section class="receipt-slip"><div><strong>Sales Receipt Slip</strong><span>${htmlEscape(report.partyName)}</span></div><div><strong>Amount Received</strong><span>${htmlEscape(report.totals.Total)}</span></div></section>`;
  }
  if (template === "grn") {
    return `<section class="signatures grn-signatures"><div class="signature">Prepared by</div><div class="signature">Quality checked by</div><div class="signature">Received into stock by</div></section>`;
  }
  if (template === "purchaseOrder") {
    return `<section class="terms"><h3>Terms and Conditions</h3><ol><li>Quote this purchase order number on delivery notes and invoices.</li><li>Deliver only approved quantities and product specifications.</li><li>Price, tax and delivery variances require written approval.</li></ol></section>`;
  }
  if (template === "delivery") {
    return `<section class="pod-box"><strong>Proof of Delivery</strong><span>Name, signature, date, condition of goods and delivery exceptions.</span></section>`;
  }
  return "";
}

function htmlDocument(report: Report, print = false) {
  const transactionRows = Object.entries(report.transaction)
    .map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value)}</dd></div>`)
    .join("");
  const headers = lineHeaders(report);
  const lineRows = report.lines
    .map(
      (line, index) => `<tr>${lineCells(report, line, index)
        .map((cell, cellIndex) => `<td class="${cellIndex >= headers.length - 3 ? "num" : ""}">${htmlEscape(cell)}</td>`)
        .join("")}</tr>`,
    )
    .join("");
  const totalRows = Object.entries(report.totals)
    .map(([label, value], index, all) => `<tr class="${index === all.length - 1 ? "grand" : ""}"><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");
  const approvalRows = Object.entries(report.approvals)
    .map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value)}</dd></div>`)
    .join("");
  const template = templateFor(report);

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
    .accent { position: absolute; left: 0; right: 0; top: 0; height: 10px; background: linear-gradient(90deg, ${brand.blue}, ${brand.cyan}, ${brand.gold}); }
    header { position: relative; display: grid; grid-template-columns: 1fr 270px; gap: 32px; align-items: start; }
    .tenant { display: grid; grid-template-columns: 82px 1fr; gap: 16px; align-items: center; }
    .tenant-logo { display: grid; width: 82px; height: 82px; place-items: center; overflow: hidden; border-radius: 14px; border: 1px solid ${brand.border}; background: ${brand.soft}; color: ${brand.blue}; font-size: 24px; font-weight: 800; }
    .tenant-logo img { max-width: 74px; max-height: 74px; object-fit: contain; }
    .tenant h1 { margin: 0 0 5px; font-size: 26px; line-height: 1.1; letter-spacing: 0; }
    .tenant p, .meta p { margin: 2px 0; color: ${brand.slate}; font-size: 12px; line-height: 1.45; }
    .doc-title { text-align: right; }
    .doc-title h2 { margin: 0; color: ${brand.navy}; font-size: 30px; font-weight: 800; letter-spacing: 0; }
    .doc-title .ref { margin-top: 8px; color: ${brand.muted}; font-size: 12px; }
    .solva-mark { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid ${brand.border}; padding: 8px 12px; color: ${brand.blue}; font-size: 12px; font-weight: 800; }
    .solva-dot { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 8px; background: ${brand.navy}; color: ${brand.cyan}; }
    .intro { position: relative; margin-top: 34px; }
    .two-column, .grn-grid, .invoice-grid, .po-grid { display: grid; gap: 18px; }
    .two-column, .grn-grid { grid-template-columns: 1fr 1fr; }
    .invoice-grid, .po-grid { grid-template-columns: 1fr 1fr 1fr; }
    .panel { border: 1px solid ${brand.border}; border-radius: 10px; background: ${brand.soft}; padding: 16px; }
    .box { border: 1px solid ${brand.border}; border-radius: 8px; background: white; padding: 14px; min-height: 116px; }
    .box.dark { background: ${brand.navy}; color: white; }
    .box.dark h3, .box.dark p { color: white; }
    .box h3, .reason-box h3, .terms h3 { margin: 0 0 10px; color: ${brand.blue}; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    .party { margin: 0 0 6px; font-size: 14px; font-weight: 800; color: ${brand.navy}; }
    .small-note { margin-top: 10px; color: ${brand.muted}; font-size: 11px; line-height: 1.5; }
    .panel h3 { margin: 0 0 10px; color: ${brand.blue}; font-size: 13px; text-transform: uppercase; letter-spacing: .03em; }
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
    .statement-summary div, .report-kpis div { border-radius: 8px; background: ${brand.surface}; padding: 13px; }
    .statement-summary span, .report-kpis span { display: block; color: ${brand.muted}; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .statement-summary strong, .report-kpis strong { display: block; margin-top: 5px; color: ${brand.blue}; font-size: 17px; }
    .report-kpis small { display: block; margin-top: 4px; color: ${brand.slate}; line-height: 1.4; }
    .reason-box, .terms, .pod-box, .receipt-slip { margin-top: 18px; border: 1px solid ${brand.border}; border-radius: 8px; background: ${brand.soft}; padding: 14px; }
    .receipt-slip { display: grid; grid-template-columns: 1fr 220px; border-style: dashed; }
    .receipt-slip strong, .receipt-slip span, .pod-box strong, .pod-box span { display: block; }
    .terms ol { margin: 0; padding-left: 18px; color: ${brand.slate}; font-size: 11px; line-height: 1.6; }
    .table-wrap { position: relative; margin-top: 26px; border: 1px solid ${brand.border}; border-radius: 10px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { background: ${brand.navy}; color: white; font-size: 11px; padding: 10px 8px; text-align: left; }
    td { border-top: 1px solid ${brand.border}; color: ${brand.navy}; font-size: 11px; line-height: 1.35; padding: 10px 8px; vertical-align: top; word-break: break-word; }
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
    footer { margin-top: 36px; border-top: 1px solid ${brand.border}; padding-top: 12px; color: ${brand.muted}; font-size: 10px; line-height: 1.5; text-align: center; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } }
  </style>
</head>
<body>
  <main class="page template-${template}">
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
        <p class="ref"># ${htmlEscape(report.transaction["Reference number"])}</p>
        <p class="ref">Generated ${htmlEscape(report.generatedAt)}</p>
        <div class="solva-mark"><span class="solva-dot">S</span> Solva Trade</div>
      </section>
    </header>

    <section class="intro">${templateIntro(report, transactionRows)}</section>

    <section class="table-wrap">
      <table>
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
      <div class="signature">Prepared by</div>
      <div class="signature">Reviewed by</div>
      <div class="signature">Received / Approved by</div>
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
  const widths = headers.length === 5 ? [78, 178, 78, 70, 126] : headers.length === 7 ? [28, 176, 70, 54, 70, 70, 62] : [62, 220, 44, 76, 58, 70];
  let y = startY;

  canvas.rect(x, y - 18, 530, 22, "navy");
  let cursor = x;
  headers.forEach((header, index) => {
    canvas.text(header, cursor + 5, y - 10, 7.5, "white", true);
    cursor += widths[index] ?? 70;
  });
  y -= 24;

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

  canvas.wrap(title, 372, 790, 190, 20, "navy", true, 22);
  canvas.text(`# ${report.transaction["Reference number"]}`, 374, 742, 9, "muted");
  canvas.text(`Generated: ${report.generatedAt}`, 374, 728, 8, "muted");
  canvas.rect(374, 698, 126, 26, "navy");
  canvas.text("S", 386, 706, 13, "cyan", true);
  canvas.text("Solva Trade", 406, 706, 10, "white", true);

  let tableStart = 572;
  if (template === "receipt") {
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
  } else if (template === "statement" || template === "finance" || template === "report" || template === "inventory") {
    const labels = template === "report" ? ["Health", "Cash / Value", "Risk"] : ["Opening", "Movements", "Closing"];
    [48, 224, 400].forEach((x, index) => {
      canvas.rect(x, 642, 164, 58, "surface");
      canvas.text(labels[index], x + 14, 676, 8, "blue", true);
      canvas.text(index === 0 ? "Ready" : index === 1 ? report.totals.Total : report.totals["Balance due"], x + 14, 654, 16, "navy", true);
    });
    canvas.text(template === "report" ? "INSIGHT DETAILS" : "LEDGER DETAILS", 48, 614, 11, "blue", true);
    tableStart = 592;
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
    canvas.text("INVOICE LINE ITEMS", 48, 594, 11, "blue", true);
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

  canvas.line(48, 96, 176, 96, "navy");
  canvas.line(242, 96, 370, 96, "navy");
  canvas.line(436, 96, 564, 96, "navy");
  canvas.text("Prepared by", 82, 82, 8, "slate");
  canvas.text("Reviewed by", 278, 82, 8, "slate");
  canvas.text(template === "grn" ? "Received into stock by" : "Received / Approved by", 452, 82, 8, "slate");
  if (template === "receipt") {
    canvas.rect(48, 116, 516, 30, "soft");
    canvas.text("SALES RECEIPT SLIP", 62, 130, 8, "blue", true);
    canvas.text(`Amount received: ${report.totals.Total}`, 394, 130, 8, "navy", true);
  }
  canvas.line(48, 58, 564, 58, "border");
  canvas.wrap(`${report.businessName} document generated by Solva Trade. Printed by ${report.generatedBy} on ${report.generatedAt}.`, 76, 42, 460, 7.5, "muted");

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
