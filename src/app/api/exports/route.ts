import { NextRequest } from "next/server";

const exportRows = [
  {
    order: "SO-0001",
    date: "2026-07-20",
    customer: "Sample Customer",
    item: "Sample Product",
    quantity: "1",
    amount: "0.00",
    status: "Draft",
    notes: "Replace sample rows with posted tenant records when live data is connected.",
  },
  {
    order: "SO-0002",
    date: "2026-07-20",
    customer: "Walk-in Customer",
    item: "Service or stock item",
    quantity: "1",
    amount: "0.00",
    status: "Ready",
    notes: "Exports include order, customer, item, quantity, amount, status and useful process context.",
  },
];

function csvSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function csv(moduleName: string, processName: string) {
  const headers = ["module", "process", "order", "date", "customer", "item", "quantity", "amount", "status", "notes"];
  const lines = [
    headers.join(","),
    ...exportRows.map((row) =>
      [
        moduleName,
        processName,
        row.order,
        row.date,
        row.customer,
        row.item,
        row.quantity,
        row.amount,
        row.status,
        row.notes,
      ]
        .map((value) => `"${csvSafe(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function pdf(moduleName: string, processName: string) {
  const lines = [
    "Solva Trade Export",
    `Module: ${moduleName}`,
    `Process: ${processName}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Order      Date        Customer            Item                 Qty  Amount   Status",
    ...exportRows.map(
      (row) =>
        `${row.order.padEnd(10)} ${row.date.padEnd(11)} ${row.customer.slice(0, 18).padEnd(19)} ${row.item.slice(0, 20).padEnd(21)} ${row.quantity.padEnd(4)} ${row.amount.padEnd(8)} ${row.status}`,
    ),
    "",
    "Notes:",
    ...exportRows.map((row) => `- ${row.order}: ${row.notes}`),
  ];
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 790 Td",
    `(${pdfText(lines[0])}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1).map((line) => `0 -18 Td (${pdfText(line)}) Tj`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
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
  const moduleName = searchParams.get("module") ?? "Solva Trade";
  const processName = searchParams.get("process") ?? "Business Process";
  const format = searchParams.get("format") ?? "csv";
  const filename = `${moduleName}-${processName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (format === "json") {
    return Response.json({ module: moduleName, process: processName, rows: exportRows });
  }

  if (format === "pdf") {
    return new Response(pdf(moduleName, processName), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  return new Response(csv(moduleName, processName), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.${format === "excel" ? "csv" : "csv"}"`,
    },
  });
}
