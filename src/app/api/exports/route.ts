import { NextRequest } from "next/server";

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
  generatedBy: string;
  generatedAt: string;
  transaction: Record<string, string>;
  lines: ReportLine[];
  totals: Record<string, string>;
  approvals: Record<string, string>;
  auditTrail: string[];
};

const brand = {
  navy: "#071A2B",
  blue: "#1455D9",
  cyan: "#18B7C9",
  gold: "#D8A43B",
  surface: "#EEF6FF",
  border: "#D8E2EE",
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

function buildReport(searchParams: URLSearchParams): Report {
  const moduleName = searchParams.get("module") ?? "Solva Trade";
  const processName = searchParams.get("process") ?? "Business Process";
  const partyName =
    searchParams.get("customer") ??
    searchParams.get("company") ??
    searchParams.get("user") ??
    searchParams.get("party") ??
    "Aquamist Nairobi Distributor";
  const generatedBy = searchParams.get("generatedBy") ?? searchParams.get("printer") ?? "Solva Trade User";
  const subtotal = defaultLines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount, 0);
  const tax = defaultLines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = defaultLines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    moduleName,
    processName,
    partyName,
    generatedBy,
    generatedAt: generatedAt(),
    transaction: {
      "Report owner": partyName,
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

function excel(report: Report) {
  const transactionRows = Object.entries(report.transaction)
    .map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");
  const lineRows = report.lines
    .map(
      (line) => `<tr>
        <td>${htmlEscape(line.sku)}</td>
        <td>${htmlEscape(line.description)}</td>
        <td>${htmlEscape(line.unit)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${money(line.unitPrice)}</td>
        <td class="num">${money(line.discount)}</td>
        <td>${htmlEscape(line.taxRate)}</td>
        <td class="num">${money(line.taxAmount)}</td>
        <td class="num">${money(line.lineTotal)}</td>
        <td>${htmlEscape(line.warehouse)}</td>
        <td>${htmlEscape(line.batch)}</td>
        <td>${htmlEscape(line.notes)}</td>
      </tr>`,
    )
    .join("");
  const totalRows = Object.entries(report.totals)
    .map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td class="num">${htmlEscape(value)}</td></tr>`)
    .join("");
  const approvalRows = Object.entries(report.approvals)
    .map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: ${brand.navy}; }
    .sheet { position: relative; padding: 24px; }
    .watermark { position: fixed; left: 32%; top: 34%; color: #d9eef4; font-size: 128px; font-weight: 800; z-index: -1; }
    .hero { background: ${brand.navy}; color: white; padding: 22px; border-radius: 8px; }
    .logo { color: ${brand.cyan}; font-size: 24px; font-weight: 800; }
    .subtitle { color: #dbeafe; margin-top: 6px; }
    .meta { margin-top: 18px; color: #dbeafe; }
    h2 { margin-top: 26px; color: ${brand.blue}; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: ${brand.surface}; color: ${brand.navy}; text-align: left; }
    th, td { border: 1px solid ${brand.border}; padding: 9px; font-size: 12px; vertical-align: top; }
    .num { text-align: right; }
    .totals { width: 45%; margin-left: auto; }
    .accent { height: 5px; background: ${brand.cyan}; margin-top: 14px; border-radius: 999px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="watermark">S</div>
    <div class="hero">
      <div class="logo">Solva Trade</div>
      <div class="subtitle">Run. Grow. Lead.</div>
      <h1>${htmlEscape(report.processName)}</h1>
      <div class="meta">
        <strong>${htmlEscape(report.partyName)}</strong><br />
        Module: ${htmlEscape(report.moduleName)}<br />
        Printed by: ${htmlEscape(report.generatedBy)}<br />
        Generated: ${htmlEscape(report.generatedAt)}
      </div>
      <div class="accent"></div>
    </div>
    <h2>Transaction or Process Details</h2>
    <table>${transactionRows}</table>
    <h2>Line Details</h2>
    <table>
      <thead>
        <tr><th>SKU</th><th>Description</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Tax Amount</th><th>Total</th><th>Warehouse</th><th>Batch</th><th>Notes</th></tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    <h2>Totals</h2>
    <table class="totals">${totalRows}</table>
    <h2>Approval and Audit</h2>
    <table>${approvalRows}</table>
    <ul>${report.auditTrail.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </div>
</body>
</html>`;
}

function pdf(report: Report) {
  const lines = [
    { text: "Solva Trade", x: 56, y: 790, size: 24, color: "cyan", bold: true },
    { text: "Run. Grow. Lead.", x: 56, y: 768, size: 10, color: "white" },
    { text: report.processName, x: 56, y: 735, size: 18, color: "navy", bold: true },
    { text: report.partyName, x: 56, y: 713, size: 12, color: "navy" },
    { text: `Module: ${report.moduleName}`, x: 56, y: 696, size: 10, color: "muted" },
    { text: `Printed by: ${report.generatedBy}`, x: 320, y: 790, size: 9, color: "white" },
    { text: `Generated: ${report.generatedAt}`, x: 320, y: 774, size: 9, color: "white" },
    { text: "Transaction Details", x: 56, y: 650, size: 13, color: "blue", bold: true },
    ...Object.entries(report.transaction).flatMap(([label, value], index) => [
      { text: label, x: index % 2 === 0 ? 56 : 320, y: 628 - Math.floor(index / 2) * 28, size: 8, color: "muted", bold: true },
      { text: value, x: index % 2 === 0 ? 56 : 320, y: 615 - Math.floor(index / 2) * 28, size: 9, color: "navy" },
    ]),
    { text: "Line Details", x: 56, y: 465, size: 13, color: "blue", bold: true },
    { text: "SKU        Description                         Qty     Unit Price     Tax      Total", x: 56, y: 442, size: 8, color: "white" },
    ...report.lines.map((line, index) => ({
      text: `${line.sku.padEnd(10)} ${line.description.slice(0, 32).padEnd(34)} ${String(line.quantity).padEnd(7)} ${money(line.unitPrice).padEnd(14)} ${money(line.taxAmount).padEnd(9)} ${money(line.lineTotal)}`,
      x: 56,
      y: 420 - index * 20,
      size: 8,
      color: "navy",
    })),
    { text: "Totals", x: 360, y: 330, size: 13, color: "blue", bold: true },
    ...Object.entries(report.totals).map(([label, value], index) => ({
      text: `${label}: ${value}`,
      x: 360,
      y: 310 - index * 18,
      size: 9,
      color: index === 2 ? "blue" : "navy",
      bold: index === 2,
    })),
    { text: "Approval and Audit", x: 56, y: 300, size: 13, color: "blue", bold: true },
    ...Object.entries(report.approvals).map(([label, value], index) => ({
      text: `${label}: ${value}`,
      x: 56,
      y: 280 - index * 18,
      size: 9,
      color: "navy",
    })),
    ...report.auditTrail.map((item, index) => ({
      text: `- ${item}`,
      x: 56,
      y: 190 - index * 16,
      size: 8,
      color: "muted",
    })),
  ];

  const colorOps: Record<string, string> = {
    navy: "0.027 0.102 0.169 rg",
    blue: "0.078 0.333 0.851 rg",
    cyan: "0.094 0.718 0.788 rg",
    gold: "0.847 0.643 0.231 rg",
    muted: "0.278 0.333 0.411 rg",
    white: "1 1 1 rg",
    watermark: "0.88 0.95 0.98 rg",
  };
  const textOps = lines
    .map((line) => {
      const font = line.bold ? "/F2" : "/F1";
      return `BT ${colorOps[line.color]} ${font} ${line.size} Tf ${line.x} ${line.y} Td (${pdfText(line.text)}) Tj ET`;
    })
    .join("\n");
  const content = [
    "0.027 0.102 0.169 rg 40 742 532 72 re f",
    "0.094 0.718 0.788 rg 40 738 532 5 re f",
    "0.847 0.643 0.231 rg 46 748 18 18 re f",
    "0.88 0.95 0.98 rg BT /F2 142 Tf 210 360 Td (S) Tj ET",
    "0.078 0.333 0.851 rg 52 432 508 18 re f",
    "0.93 0.96 1 rg 52 402 508 1 re f",
    textOps,
  ].join("\n");
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

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const report = buildReport(searchParams);
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
    return new Response(excel(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`,
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
