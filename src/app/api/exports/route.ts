import { NextRequest } from "next/server";
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
    const { data: membership } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const businessId = membership?.business_id ?? metadataBusinessId;
    if (!businessId) return { ...fallback, generatedBy };

    const { data: business } = await supabase
      .from("businesses")
      .select("trading_name, legal_name, logo_path, phone, email, physical_address, county, country, kra_pin")
      .eq("id", businessId)
      .maybeSingle();
    if (!business) return { ...fallback, generatedBy };

    return {
      businessName: business.trading_name ?? business.legal_name ?? fallback.businessName,
      businessLogoPath: business.logo_path ?? null,
      businessPhone: business.phone ?? "",
      businessEmail: business.email ?? "",
      businessLocation: [business.physical_address, business.county, business.country].filter(Boolean).join(", ") || "Kenya",
      kraPin: business.kra_pin ?? "",
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

function documentIntro(report: Report) {
  const family = familyFor(report);
  if (family === "purchase") return "Supplier, stock receiving, approval and matching details.";
  if (family === "distribution") return "Dispatch, delivery, route, vehicle and proof-of-delivery details.";
  if (family === "finance") return "Cash, bank, ledger, voucher, balance and approval details.";
  if (family === "tax") return "Tax period, taxable value, compliance and filing details.";
  if (family === "statement") return "Opening balance, movements, payments and closing balance.";
  if (family === "report") return "Business insight, supporting figures, commentary and recommended action.";
  if (family === "inventory") return "Stock, warehouse, batch, movement, count and valuation details.";
  return "Customer, sale, invoice, receipt, delivery and payment details.";
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
    .intro { position: relative; margin-top: 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .panel { border: 1px solid ${brand.border}; border-radius: 10px; background: ${brand.soft}; padding: 16px; }
    .panel h3 { margin: 0 0 10px; color: ${brand.blue}; font-size: 13px; text-transform: uppercase; letter-spacing: .03em; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    dt { color: ${brand.muted}; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    dd { margin: 2px 0 0; color: ${brand.navy}; font-size: 12px; line-height: 1.35; }
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
  <main class="page">
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

    <section class="intro">
      <article class="panel">
        <h3>Party Details</h3>
        <p><strong>${htmlEscape(report.partyName)}</strong></p>
        <p>${htmlEscape(documentIntro(report))}</p>
      </article>
      <article class="panel">
        <h3>Document Details</h3>
        <dl class="details">${transactionRows}</dl>
      </article>
    </section>

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

  canvas.rect(48, 628, 250, 72, "soft");
  canvas.rect(314, 628, 250, 72, "soft");
  canvas.text("PARTY DETAILS", 62, 676, 9, "blue", true);
  canvas.wrap(report.partyName, 62, 656, 210, 12, "navy", true);
  canvas.wrap(documentIntro(report), 62, 638, 210, 8.5, "slate");
  canvas.text("DOCUMENT DETAILS", 328, 676, 9, "blue", true);
  canvas.text(`Date: ${report.transaction["Document date"]}`, 328, 656, 8.5, "navy");
  canvas.text(`Due: ${report.transaction["Due or action date"]}`, 328, 642, 8.5, "navy");
  canvas.text(`Branch: ${report.transaction.Branch}`, 328, 628, 8.5, "navy");

  canvas.text("LINE DETAILS", 48, 594, 11, "blue", true);
  const yAfterTable = renderPdfTable(canvas, report, 572);

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
  canvas.text("Received / Approved by", 452, 82, 8, "slate");
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
