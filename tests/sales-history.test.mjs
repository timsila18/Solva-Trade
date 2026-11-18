import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let state = [], cursor = 0;
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/components/app/sales-history.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, URLSearchParams, require(name) {
  if (name === "react") return {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useMemo: fn => fn(),
  };
  if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
  return require(name);
} });
const rows = Array.from({ length: 123 }, (_, i) => ({ id: `id-${i}`, customerName: i === 122 ? "Café last" : "Customer",
  invoiceNumber: `INV-${i}`, invoiceDate: "2026-11-18", total: i, paid: i, phone: i === 122 ? "0799999999" : "" }));
let nodes;
function render(initialQuery = "") {
  cursor = 0; nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node.type === "function") return visit(node.type(node.props));
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(exports.SalesHistory({ rows, initialQuery }));
}
const links = () => nodes.filter(node => node.type === "a");
const input = () => nodes.find(node => node.type === "input");
const more = () => nodes.find(node => node.type === "button" && !node.props["aria-label"]);
render();
assert.equal(links().length, 0);
assert.equal(input(), undefined);
nodes.find(node => node.type === "details").props.onToggle({ currentTarget: { open: true } });
render();
assert.equal(links().length, 100);
assert.equal(new URL(links()[0].props.href, "http://localhost").searchParams.get("invoiceId"), "id-0");
for (const link of links()) {
  const params = new URL(link.props.href, "http://localhost").searchParams;
  assert.equal(params.size, 4);
  assert.equal(params.get("format"), "pdf");
}
more().props.onClick(); render(); assert.equal(links().length, 200);
more().props.onClick(); render(); assert.equal(links().length, 246); assert.equal(more(), undefined);
input().props.onChange({ currentTarget: { value: "cafe" } }); render();
assert.equal(links().length, 2);
assert.match(links()[0].props.href, /id-122/);
input().props.onChange({ currentTarget: { value: "0799999999" } }); render(); assert.equal(links().length, 2);
input().props.onChange({ currentTarget: { value: "missing" } }); render(); assert.equal(links().length, 0);
nodes.find(node => node.props["aria-label"] === "Clear search sales history").props.onClick();
render(); assert.equal(links().length, 100);
nodes.find(node => node.type === "details").props.onToggle({ currentTarget: { open: false } });
render(); assert.equal(links().length, 0);
state = []; render("INV-122"); assert.equal(links().length, 2);
assert.match(links()[0].props.href, /id-122/);
const page = readFileSync("src/app/(app)/sales/page.tsx", "utf8");
assert.match(page, /completedInvoices = .*\.sort\(newestInvoiceFirst\)/);
assert.match(page, /<SalesHistory initialQuery=\{historyCustomerQuery\}/);
assert.doesNotMatch(page, /content:[\s\S]*?completedInvoices/);
const realExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/components/app/sales-history.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: realExports, URLSearchParams, require });
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const closedHtml = renderToStaticMarkup(createElement(realExports.SalesHistory, { rows }));
assert.doesNotMatch(closedHtml, /\/api\/exports|<input|INV-/);
const openHtml = renderToStaticMarkup(createElement(realExports.SalesHistory, { rows, initialQuery: "INV-" }));
assert.equal((openHtml.match(/href=/g) ?? []).length, 100);
console.log(`ok - real React SSR: collapsed HTML ${Buffer.byteLength(closedHtml)} bytes, no invoice markup or export links; open HTML has only 50 invoice pairs`);
console.log("ok - collapsed history has no rows; 50-row increments reach every invoice; full-data accent/phone search, reset, deep-link opening and compact ID exports");
