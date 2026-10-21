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
    requests.push(table);
    let single = false;
    const query = new Proxy({}, { get(_, method) {
      if (method === "then") return (resolve) => resolve({ data: single ? fixtures[table]?.[0] : fixtures[table], error: failedTable === table ? { message: "Database unavailable" } : null });
      if (method === "maybeSingle") return () => { single = true; return query; };
      return () => query;
    } });
    return query;
  },
};
const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, require(id) {
  if (id === "server-only") return {};
  if (id.endsWith("supabase/server")) return { createSupabaseServerClient: async () => client };
  if (id.endsWith("tenant")) return { getActiveBusinessId: async () => "business" };
  return require(id);
} });
const result = await module.exports.getSalesWorkflowLookups();
assert.equal(result.products.length, 300);
assert.equal(result.products[0].vatRate, 16);
assert.equal(result.products[0].available, 12);
assert.equal(result.products[1].vatRate, 8);
assert.equal(result.products[2].vatRate, 0);
assert.equal(result.products[3].vatRate, 5);
assert.equal(requests.length, 10, "Database requests must stay constant with 300 products");
console.log("ok - 300 products load in 10 queries with tax precedence and live stock preserved");
failedTable = "product_tax_mappings";
await assert.rejects(module.exports.getSalesWorkflowLookups(), /Could not load product tax settings/);
console.log("ok - failed tax queries surface an error instead of silently changing sale calculations");
