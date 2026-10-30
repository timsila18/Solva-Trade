import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({}) });
  return exports;
}
const { collectedPayments, productSalesPeriod } = load("../src/lib/sales-metrics.ts");
const start = "2026-10-28T21:00:00.000Z", end = "2026-10-29T21:00:00.000Z";
const payment = (id, date, status = "allocated", amount = 100) => ({ id, payment_date: date, amount_received: amount, status });
const rows = Array.from({ length: 1501 }, (_, index) => payment(String(index), "2026-10-29T12:00:00+00:00"));
rows.push(payment("boundary-start", "2026-10-29T00:00:00+03:00", "partially_allocated", 50));
rows.push(payment("boundary-end", "2026-10-30T00:00:00+03:00"));
for (const status of ["reversed", "rejected", "draft"]) rows.push(payment(status, "2026-10-29T12:00:00Z", status));
rows.push(rows[0]);
const result = collectedPayments(rows, start, end);
assert.equal(result.count, 1502);
assert.equal(result.amount, 150150);
console.log("ok - cash collected includes over 1000 receipts once, respects Nairobi midnight and excludes invalid receipts");
assert.equal(productSalesPeriod("monthly", "2024-02-12").end, "2024-02-29");
assert.equal(productSalesPeriod("weekly", "2026-03-01").start, "2026-02-23");
assert.equal(productSalesPeriod("weekly", "2026-03-01").end, "2026-03-01");
assert.equal(productSalesPeriod("yearly", "2026-10-30").end, "2026-12-31");
assert.equal(productSalesPeriod("daily", "2026-10-30").start, "2026-10-30");
assert.equal(productSalesPeriod("custom", "2026-10-30", "2026-08-01", "2026-08-31").end, "2026-08-31");
assert.throws(() => productSalesPeriod("custom", "2026-10-30", "2026-09-30", "2026-09-01"));
assert.throws(() => productSalesPeriod("daily", "2026-02-30"));
console.log("ok - daily, Monday-to-Sunday, monthly, yearly and custom product report periods are calendar correct");
const { loadProductSales, summarizeProductSales } = load("../src/lib/product-sales-data.ts");
const queries = [];
let fail = false;
const client = { from(table) {
  const calls = [];
  queries.push({ table, calls });
  const query = new Proxy({}, { get(_, method) {
    if (method === "then") return (resolve) => {
      const [, start, end] = calls.find(([name]) => name === "range");
      const count = Math.max(0, Math.min(end + 1, 2105) - start);
      const data = Array.from({ length: count }, (_, index) => ({ id: String(start + index), product_id: "p1", invoice_quantity: 2, line_total: 1900, unit: null, products: { product_name: "Keringet 500ml", sku: "SKU", unit: { name: "Case" } }, sales_invoices: { id: `i${start + index}`, invoice_number: `INV-${start + index}`, invoice_date: "2026-10-29", customers: { customer_name: "Customer" } } }));
      resolve({ data, error: fail ? { message: "Unavailable" } : null });
    };
    return (...args) => { calls.push([method, ...args]); return query; };
  } });
  return query;
} };
const sales = await loadProductSales(client, "business", "2026-10-01", "2026-10-31", "p1");
assert.equal(sales.length, 2105);
assert.equal(queries.length, 3);
for (const { calls } of queries) {
  assert.ok(calls.some(([method, field, value]) => method === "eq" && field === "business_id" && value === "business"));
  assert.ok(calls.some(([method, field, value]) => method === "eq" && field === "product_id" && value === "p1"));
  const statuses = calls.find(([method, field]) => method === "in" && field === "sales_invoices.status")[2];
  assert.equal(statuses.includes("reversed"), false);
  assert.equal(statuses.includes("cancelled"), false);
}
const summary = summarizeProductSales(sales);
assert.equal(summary[0].quantity, 4210);
assert.equal(summary[0].invoiceCount, 2105);
assert.equal(summary[0].unit, "Case");
assert.equal(summary[0].amount, 3999500);
fail = true;
await assert.rejects(loadProductSales(client, "business", "2026-10-01", "2026-10-31"), /Could not load product sales/);
console.log("ok - product report loads every page, filters by tenant and product, excludes reversed sales and retains case units");
