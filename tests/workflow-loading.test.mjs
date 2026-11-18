import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/workflow-live-data.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const requests = [];
const fixtures = {
  branches: [{ id: "branch" }], warehouses: [{ id: "warehouse" }], customers: [], suppliers: [], sales_invoices: [],
  stock_balances: [{ product_id: "p0", available_quantity: 12 }],
  products: Array.from({ length: 300 }, (_, index) => ({ id: `p${index}`, product_name: `Product ${index}`, default_sales_tax_id: index === 1 ? "direct" : null, vat_status: index === 2 ? "exempt" : null })),
  tax_rates: [{ id: "direct", tax_code: "CUSTOM", rate: 8 }],
  product_tax_mappings: [{ product_id: "p3", sales_vat_code_id: "mapped" }, { product_id: "p3", sales_vat_code_id: "global" }],
  vat_codes: [{ id: "tenant", business_id: "business", vat_code: "VAT_STD", rate: 16 }, { id: "global", business_id: null, vat_code: "VAT_STD", rate: 20 }, { id: "mapped", business_id: "business", vat_code: "SPECIAL", rate: 5 }],
};
let failedTable;
const client = {
  auth: { getUser: async () => ({ data: { user: {} } }) },
  from(table) {
    let single = false;
    let from = 0;
    let to = Infinity;
    const query = new Proxy({}, { get(_, method) {
      if (method === "then") return (resolve) => {
        requests.push(table);
        resolve({ data: single ? fixtures[table]?.[0] : fixtures[table]?.slice(from, Math.min(to + 1, from + serverLimit)), count: fixtures[table]?.length, error: failedTable === table ? { message: "Database unavailable" } : null });
      };
      if (method === "range") return (start, end) => { from = start; to = end; return query; };
      if (method === "maybeSingle") return () => { single = true; return query; };
      return () => query;
    } });
    return query;
  },
};
let serverLimit = 1000;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { exports: loaded.exports, require(id) {
  if (id === "server-only") return {};
  if (id.endsWith("supabase/server")) return { createSupabaseServerClient: async () => client };
  if (id.endsWith("tenant")) return { getActiveBusinessId: async () => "business" };
  return require(id);
} });
const result = await loaded.exports.getSalesWorkflowLookups();
assert.equal(result.products.length, 300);
assert.equal(result.products[0].vatRate, 16);
assert.equal(result.products[0].available, 12);
assert.equal(result.products[1].vatRate, 8);
assert.equal(result.products[2].vatRate, 0);
assert.equal(result.products[3].vatRate, 5);
assert.equal(requests.length, 10, "Batched lookups must not issue per-product queries or empty probes");
console.log("ok - 300 products load in batched queries with tax precedence and live stock preserved");
requests.length = 0;
const purchase = await loaded.exports.getSalesWorkflowLookups({ includeCustomers: false, includeInvoices: false });
assert.equal(requests.length, 8);
assert.equal(requests.includes("customers"), false);
assert.equal(requests.includes("sales_invoices"), false);
assert.equal(JSON.stringify(purchase.products), JSON.stringify(result.products));
console.log("ok - receiving skips irrelevant customer and invoice requests");
failedTable = "product_tax_mappings";
await assert.rejects(loaded.exports.getSalesWorkflowLookups(), /Could not load product tax settings/);
console.log("ok - failed tax queries surface an error instead of silently changing sale calculations");
failedTable = undefined;
serverLimit = 127;
fixtures.products = Array.from({ length: 1305 }, (_, index) => ({ id: `p${index}`, product_name: `Product ${index}` }));
fixtures.suppliers = Array.from({ length: 1205 }, (_, index) => ({ id: `s${index}`, legal_name: `Supplier ${index}` }));
fixtures.customers = Array.from({ length: 1105 }, (_, index) => ({ id: `c${index}`, customer_name: `Customer ${index}` }));
fixtures.sales_invoices = Array.from({ length: 305 }, (_, index) => ({ id: `i${index}` }));
fixtures.stock_balances = fixtures.products.map((product) => ({ product_id: product.id, available_quantity: 7 }));
const complete = await loaded.exports.getSalesWorkflowLookups();
assert.equal(complete.products.length, 1305);
assert.equal(complete.suppliers.length, 1205);
assert.equal(complete.customers.length, 1105);
assert.equal(complete.unpaidInvoices.length, 305);
assert.equal(complete.products.at(-1).available, 7);
assert.equal(new Set(complete.products.map((p) => p.id)).size, 1305);
console.log("ok - all lookup rows load beyond old caps, including stock, with a 127-row server limit");
failedTable = "products";
await assert.rejects(loaded.exports.getSalesWorkflowLookups(), /Could not load products/);
console.log("ok - lookup failures do not masquerade as empty datasets");
