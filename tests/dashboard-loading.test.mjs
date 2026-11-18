import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: (name) => dependencies[name] ?? {}, ...globals });
  return exports;
}
const loading = load("../src/lib/dashboard-loading.ts");
for (const length of [0, 999, 1000, 2105]) {
  const ranges = [];
  const rows = await loading.fetchAllPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: Array.from({ length: Math.max(0, Math.min(length, to + 1) - from) }, (_, i) => from + i), error: null, count: from === 0 ? length : null };
  });
  assert.equal(rows.length, length);
  assert.equal(new Set(rows).size, length);
  assert.equal(ranges.length, Math.max(1, Math.ceil(length / 1000)));
}
const capped = await loading.fetchAllPages(async (from) => ({
  data: Array.from({ length: Math.min(127, 2105 - from) }, (_, i) => from + i),
  error: null, count: from === 0 ? 2105 : null,
}));
assert.equal(capped.length, 2105);
assert.equal(capped[2104], 2104);
await assert.rejects(loading.fetchAllPages(async () => ({ data: null, error: { message: "offline" } })), /offline/);

const now = "2027-01-01T10:00:00Z";
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
const today = "2027-01-01";
const many = (make) => Array.from({ length: 2105 }, (_, i) => make(String(i)));
const fixtures = {
  business_memberships: [{ business_id: "business" }],
  businesses: [{ trading_name: "Test business" }], branches: [{ branch_name: "Test branch" }],
  sales_invoices: [
    { id: "today", invoice_date: today, total_amount: 1000, tax_total: 100, balance_due: 100, status: "posted" },
    { id: "last-year", invoice_date: "2026-12-28", total_amount: 500, balance_due: 50, status: "posted" },
    { id: "draft", invoice_date: today, total_amount: 70, balance_due: 0, status: "draft" },
    { id: "cancelled", invoice_date: today, total_amount: 9999, balance_due: 9999, status: "cancelled" },
    { id: "no-cost", invoice_date: today, total_amount: 900, balance_due: 0, status: "posted" },
    { id: "old-debt", invoice_date: "2020-01-01", total_amount: 100, balance_due: 25, status: "posted" },
  ],
  customer_payments: many((id) => ({ id, payment_date: "2026-12-31T21:00:00Z", amount_received: 2, status: "allocated" })),
  customers: many((id) => ({ id, active: true, status: "active" })),
  products: many((id) => ({ id, active: true, track_inventory: true, reorder_level: 0 })),
  stock_balances: many((id) => ({ id, product_id: id, quantity_on_hand: 2, available_quantity: 2, total_inventory_value: 3, reorder_status: "healthy" })),
  sales_source_allocations: [
    { id: "cost", sales_invoice_id: "today", total_cost: 400, allocated_at: "2026-01-01" },
    { id: "late-cost", sales_invoice_id: "today", total_cost: 100, allocated_at: "2027-02-01" },
    { id: "old-cost", sales_invoice_id: "last-year", total_cost: 200 },
  ],
  expenses: [{ id: "e", expense_date: today, total_paid: 50 }, { id: "old-e", expense_date: "2026-12-28", total_paid: 20 }],
  workflow_records: many((id) => ({ id, module_name: "Purchasing", process_name: "Goods Received", reference_number: id, created_at: "2026-12-31T22:00:00Z" })),
};
let calls = [], labelWaiters = [], failTable;
const admin = { from(table) {
  const operations = [];
  const query = new Proxy({}, { get(_, method) {
    if (method === "then") return (resolve) => {
      calls.push({ table, operations });
      const execute = () => {
        if (table === failTable) return resolve({ data: null, error: { message: "query failed" } });
        let rows = fixtures[table];
        for (const [op, field, value] of operations) {
          // Apply date predicates including embedded invoice dates, not allocation time.
          if (!["gte", "lte", "lt"].includes(op)) continue;
          rows = rows.filter((row) => {
            const actual = field === "sales_invoices.invoice_date"
              ? fixtures.sales_invoices.find((invoice) => invoice.id === row.sales_invoice_id)?.invoice_date : row[field];
            return op === "gte" ? actual >= value : op === "lte" ? actual <= value : actual < value;
          });
        }
        const count = operations.find(([op]) => op === "select")?.[2]?.count === "exact" ? rows.length : null;
        const range = operations.find(([op]) => op === "range");
        if (range) rows = rows.slice(range[1], range[2] + 1);
        const limit = operations.find(([op]) => op === "limit");
        if (limit) rows = rows.slice(0, limit[1]);
        resolve({ data: operations.some(([op]) => op === "maybeSingle") ? rows[0] : rows, error: null, count });
      };
      // Labels cannot finish until the datasets start: detects reintroduced serialization.
      if (["businesses", "branches"].includes(table)) labelWaiters.push(execute);
      else { for (const release of labelWaiters.splice(0)) release(); execute(); }
    };
    return (...args) => { operations.push([method, ...args]); return query; };
  } });
  return query;
} };
const jsx = (type, props) => ({ type, props });
const premium = new Proxy({}, { get: (_, name) => name });
const metrics = load("../src/lib/sales-metrics.ts");
const { default: Dashboard } = load("../src/app/(app)/dashboard/page.tsx", {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "@/components/ui/premium": premium,
  "@/components/app/profit-privacy-card": { ProfitPrivacyCard: "ProfitPrivacyCard" },
  "@/lib/business-intelligence-data": Object.fromEntries(["alertExamples", "commandCentreFacts", "executiveDashboards", "morningBrief", "quickActions", "timelineFoundation"].map((key) => [key, []])),
  "@/lib/business-intelligence": { rankAlerts: () => [], generateRecommendations: () => [] },
  "@/lib/supabase/admin": { createSupabaseAdminClient: () => admin },
  "@/lib/supabase/server": { getSupabaseUser: async () => ({ data: { user: { id: "user", app_metadata: {}, user_metadata: {} } } }) },
  "@/lib/sales-metrics": metrics, "@/lib/dashboard-loading": loading,
}, { Date: FixedDate, Intl });
const tree = await Promise.race([Dashboard(), new Promise((_, reject) => setTimeout(() => reject(new Error("Dashboard serialized labels before datasets")), 2000))]);
const nodes = [];
function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(walk);
  nodes.push(node); walk(node.props?.children);
}
walk(tree);
const profit = nodes.find((node) => node.type === "ProfitPrivacyCard").props.periods;
assert.equal(profit[0].amount, 450);
assert.equal(profit[1].amount, 730); // Previous-year Monday and its expense included.
assert.equal(profit[2].amount, 450);
assert.equal(profit[3].amount, 450);
const tile = (label) => nodes.find((node) => node.type === "DashboardTile" && node.props.label === label)?.props;
assert.equal(tile("Cash collected").value, "KES 4,210");
assert.equal(tile("Customers owing").value, "KES 175");
assert.equal(tile("Active customers").value, "2,105");
assert.equal(nodes.find((node) => node.type === "MetricCard" && node.props.label === "Stock value").props.value, "KES 6,315");
assert.ok(JSON.stringify(tree).includes("2105 GRNs posted today"));
assert.equal(calls.length, 22); // Five 2,105-row datasets; all other queries fit one page.
for (const table of ["customers", "products", "stock_balances", "customer_payments"]) {
  assert.equal(calls.filter((call) => call.table === table).length, 3, table);
  const pages = calls.filter((call) => call.table === table);
  assert.equal(pages[0].operations.find(([op]) => op === "select")[2].count, "exact");
  assert.equal(pages[1].operations.find(([op]) => op === "select")[2].count, undefined);
}
for (const { table, operations } of calls) {
  if (["business_memberships", "businesses"].includes(table)) continue;
  assert.ok(operations.some(([op, field, value]) => op === "eq" && field === "business_id" && value === "business"), table);
}
const costs = calls.find((call) => call.table === "sales_source_allocations");
assert.ok(!costs.operations.some(([op, field]) => ["gte", "lt"].includes(op) && field === "allocated_at"));
assert.ok(costs.operations.some(([op, field]) => op === "gte" && field === "sales_invoices.invoice_date"));
const invoices = calls.find((call) => call.table === "sales_invoices");
assert.ok(invoices.operations.some(([op, value]) => op === "or" && value.includes("balance_due.gt.0")));
assert.equal(labelWaiters.length, 0);
failTable = "stock_balances";
await assert.rejects(Dashboard(), /query failed/);
console.log("ok - dashboard pagination, concurrent labels, full cash, FIFO profit, year boundary, tenant filters and fail-closed errors");
