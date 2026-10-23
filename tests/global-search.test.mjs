import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/lib/global-search.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({}) });
let failedTable;
const requests = [];
const fixtures = {
  customers: [{ id: "c1", customer_name: "Ken Mwangangi", customer_code: "CUS-1", phone: "0700000000" }],
  suppliers: [{ id: "s1", legal_name: "Supplier", trading_name: "Supplier" }],
  products: [{ id: "p1", product_name: "Coke 1Lt", sku: "COKE-1LT" }],
  sales_invoices: [{ id: "i1", invoice_number: "INV-1", total_amount: 930 }],
  goods_received_notes: [{ id: "g1", grn_number: "GRN-1" }],
  customer_payments: [{ id: "r1", payment_number: "RCPT-1", amount_received: 930, customers: { customer_name: "Ken Mwangangi" } }],
};
const client = { from(table) {
  const request = { table, calls: [] };
  requests.push(request);
  const query = new Proxy({}, { get(_, method) {
    if (method === "then") return (resolve) => resolve({ data: failedTable === table ? null : fixtures[table], error: failedTable === table ? { message: "Unavailable" } : null });
    return (...args) => { request.calls.push([method, ...args]); return query; };
  } });
  return query;
} };
const { results, partial } = await exports.searchWorkspace(client, "business-1", "ke");
assert.equal(partial, false);
assert.equal(results.length, 6);
for (const request of requests) {
  assert.ok(request.calls.some(([method, field, value]) => method === "eq" && field === "business_id" && value === "business-1"));
  assert.ok(request.calls.some(([method, limit]) => method === "limit" && limit === 5));
}
assert.match(results.find((row) => row.group === "Customers").href, /historyCustomer=Ken%20Mwangangi/);
assert.match(results.find((row) => row.group === "Invoices").href, /invoiceId=i1/);
assert.match(results.find((row) => row.group === "Receipts").hint, /930/);
console.log("ok - global search queries are business-scoped, bounded, and produce real document links");
requests.length = 0;
await exports.searchWorkspace(client, "business-1", "(),%_*");
assert.equal(requests.length, 0);
await exports.searchWorkspace(client, "business-1", "ke),id.neq.secret");
for (const { calls } of requests) for (const [method, value] of calls) if (method === "or") assert.equal(value.includes("id.neq"), false);
console.log("ok - query syntax and wildcard input cannot widen search filters");
failedTable = "products";
const unavailable = await exports.searchWorkspace(client, "business-1", "ke");
assert.equal(unavailable.partial, true);
assert.equal(unavailable.results.some((row) => row.group === "Products"), false);
console.log("ok - partial search failures preserve available records and report unavailable results");
