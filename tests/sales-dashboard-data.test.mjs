import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/sales-dashboard-data.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports });
const { loadSalesDashboardRows } = exports;
const rows = Array.from({ length: 6107 }, (_, i) => ({ id: String(i).padStart(6, "0"), balance_due: i + 1 }));
const calls = [];
let failAfter;
const client = { from(table) {
  const call = { table };
  calls.push(call);
  const query = {
    select(columns) { call.columns = columns; return query; },
    eq(column, value) { call.tenant = [column, value]; return query; },
    order(column) { call.order = column; return query; },
    limit(size) { call.limit = size; return query; },
    gt(column, value) { call.cursor = [column, value]; return query; },
    then(resolve) {
      const after = call.cursor?.[1];
      resolve({ data: rows.filter(row => !after || row.id > after).slice(0, 700),
        error: failAfter && after ? { message: "offline" } : null });
    },
  };
  return query;
} };
const result = await loadSalesDashboardRows(client, "sales_invoices", "id,balance_due", "tenant-a");
assert.equal(result.length, 6107);
assert.equal(new Set(result.map(row => row.id)).size, 6107);
assert.equal(result.reduce((sum, row) => sum + row.balance_due, 0), 6107 * 6108 / 2);
for (const call of calls) {
  assert.deepEqual(call.tenant, ["business_id", "tenant-a"]);
  assert.equal(call.order, "id");
  assert.equal(call.limit, 1000);
}
assert.equal(calls.length, 10);
failAfter = true;
await assert.rejects(loadSalesDashboardRows(client, "sales_invoices", "id", "tenant-b"), /offline/);
const page = readFileSync("src/app/(app)/sales/page.tsx", "utf8");
assert.match(page, /suppliers, \{ products, productReportError \}\] = await Promise.all/);
assert.doesNotMatch(page, /\.limit\((5000|2000)\)/);
assert.match(page, /\.eq\("active", true\)/);
assert.match(page, /export const dynamic = "force-dynamic"/);
assert.doesNotMatch(page, /label_invoice_number:/, "Document links must use invoice IDs, not duplicate invoice details in every URL");
console.log("ok - full invoice totals beyond 5000, smaller server caps, tenant filters, cursor batches, errors, and concurrent product loading");
