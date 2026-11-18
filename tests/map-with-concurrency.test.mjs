import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync("src/lib/map-with-concurrency.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const { mapWithConcurrency } = exports;
const tick = () => new Promise(resolve => setTimeout(resolve, 1));

for (const count of [0, 1, 20, 100]) {
  let active = 0;
  let peak = 0;
  const calls = [];
  const result = await mapWithConcurrency(Array.from({ length: count }, (_, i) => i), 8, async (item, index) => {
    active++;
    peak = Math.max(peak, active);
    calls.push(index);
    await tick();
    if (index % 2 === 0) await tick();
    active--;
    return item * 2;
  });
  assert.equal(active, 0);
  assert.equal(peak, Math.min(8, count));
  assert.deepEqual([...result], Array.from({ length: count }, (_, i) => i * 2));
  assert.deepEqual(calls, Array.from({ length: count }, (_, i) => i));
}
for (const limit of [0, -1, 1.5, NaN, Infinity]) {
  await assert.rejects(mapWithConcurrency([1], limit, async value => value), /positive integer/);
}
const failure = new Error("first failure");
const calls = [];
let active = 0;
await assert.rejects(mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, (item) => {
  calls.push(item);
  if (item === 0) throw failure;
  return (async () => {
    active++;
    await tick();
    active--;
    if (item === 4) throw new Error("later failure");
    return item;
  })();
}), error => error === failure);
assert.equal(active, 0);
assert.deepEqual(calls, Array.from({ length: 20 }, (_, i) => i));
await assert.rejects(mapWithConcurrency([1], 1, async () => { throw undefined; }), error => error === undefined);

// Exercise the request-local resolver declaration directly from the submission path.
const actions = readFileSync("src/app/(app)/actions.ts", "utf8");
const resolverSource = actions.match(/  let tzSupplierPromise:[\s\S]*?const resolveTzSupplier = [^\n]+/)[0];
for (const rejected of [false, true]) {
  let lookups = 0;
  const lookupError = new Error("lookup failed");
  const context = { admin: {}, businessId: "tenant-a", findSupplierByName: async () => {
    lookups++;
    await tick();
    if (rejected) throw lookupError;
    return null;
  } };
  vm.runInNewContext(ts.transpileModule(`${resolverSource}\nglobalThis.resolve = resolveTzSupplier;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  const first = context.resolve();
  const promises = Array.from({ length: 100 }, () => context.resolve());
  assert.ok(promises.every(promise => promise === first));
  const results = await Promise.allSettled(promises);
  assert.equal(lookups, 1);
  assert.ok(results.every(result => rejected ? result.reason === lookupError : result.value === null));
}
assert.match(actions, /await mapWithConcurrency\(\s*movementWork,\s*8,/);
console.log("ok - concurrency limits, ordered results, once-only execution, draining errors, and request-local TZ promise deduplication");
