import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/app/multi-line-transaction-form.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
let slots = [], cursor = 0, renderedRows = 0;
const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
const memoValue = (fn, deps) => {
  const index = cursor++;
  if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn(), deps };
  return slots[index].value;
};
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
  },
  useRef: (initial) => memoValue(() => ({ current: initial }), []),
  useMemo: memoValue,
  useCallback: (fn, deps) => memoValue(() => fn, deps),
  useEffect() {},
  memo(fn) {
    const cache = new Map();
    return (props) => {
      const old = cache.get(props.index);
      if (old && Object.keys(props).every((key) => Object.is(props[key], old.props[key]))) return old.tree;
      renderedRows++;
      const tree = fn(props);
      cache.set(props.index, { props, tree });
      return tree;
    };
  },
};
const jsx = (type, props) => ({ type, props });
class Element { closest() { return form; } }
class Input extends Element { constructor(name, value = "") { super(); this.name = name; this.value = value; this.checked = false; } }
class Form extends Element {}
const fields = new Map();
const form = new Form();
form.elements = { namedItem: (name) => fields.get(name) ?? null };
const row = { querySelector: () => null };
const loaded = { exports: {} };
vm.runInNewContext(compiled, { exports: loaded.exports, HTMLElement: Element, HTMLInputElement: Input, HTMLFormElement: Form, require(id) {
  if (id === "react") return react;
  if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (id === "lucide-react") return { Search: "icon" };
  if (id === "next/link") return { default: "a" };
  if (id === "next/navigation") return { usePathname: () => "/sales/new" };
  throw new Error(id);
} });
function expand(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === "function") return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((n) => find(n, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}
const products = Array.from({ length: 1000 }, (_, i) => ({ id: `p${i}`, name: `Product ${i}`, code: `P${i}`, price: 116, vatRate: 16, available: 100, trackInventory: true }));
for (const mode of ["sale", "goods-received"]) {
  slots = []; fields.clear(); renderedRows = 0;
  const render = () => { cursor = 0; return expand(loaded.exports.MultiLineTransactionForm({ mode, products, today: "2026-11-18" })); };
  let tree = render();
  assert.equal(renderedRows, 1000);
  find(tree, (n) => n.type === "input" && n.props.placeholder === `Search saved ${mode === "sale" ? "customer" : "supplier"}`).props.onChange({ currentTarget: { value: "a" } });
  tree = render();
  assert.equal(renderedRows, 1000, "Party typing must render zero product rows");
  const field = (suffix, value = "") => { const input = new Input(`field_line_0_${suffix}`, value); fields.set(input.name, input); return input; };
  const checkbox = field("selected"); checkbox.closest = () => row;
  field("quantity", "1.25"); field(mode === "sale" ? "unit_price" : "unit_cost", "116");
  field("discount", "5"); field("rejected_quantity", "0.25");
  field("tax_amount"); field("line_subtotal"); field("line_total");
  for (const name of ["subtotal", "tax", "total"]) fields.set(`field_${name}`, new Input(`field_${name}`));
  checkbox.checked = true;
  // closest(tr) is used only on the checkbox; event target resolves the form.
  find(tree, (n) => n.props?.name === "field_line_0_selected").props.onChange({ currentTarget: Object.assign(new Input(checkbox.name), { checked: true }) });
  tree = render();
  assert.equal(renderedRows, 1001, "Selection must render only the changed row");
  assert.equal(fields.get("field_total").value, mode === "sale" ? "140.00" : "116.00");
  assert.equal(fields.get("field_line_0_quantity").value, "1.25", "Calculation must not rewrite numeric input text");
  const total = Number(fields.get("field_tax").value);
  assert.equal(total, mode === "sale" ? 19.31 : 0);
  const search = find(tree, (n) => n.props?.placeholder === (mode === "sale" ? "Search product to sell" : "Search delivered product"));
  search.props.onChange({ currentTarget: { value: "Product 999" } });
  tree = render();
  assert.equal(find(tree, (n) => n.props?.name === "field_line_0_quantity").props.defaultValue, "");
  assert.equal(find(tree, (n) => n.type === "tr" && find(n.props.children, (c) => c.props?.name === "field_line_0_quantity")).props.hidden, true);
  assert.equal(fields.get("field_line_0_quantity").value, "1.25");
  console.log(`ok - ${mode}: 1000 rows, zero row renders on party typing, one on selection; numeric values, tax and hidden rows preserved`);
}
