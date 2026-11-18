import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: (id) => overrides[id] || require(id),
  });
  return exports;
}
const { withRequestMemo, memoInRequest } = load("src/lib/request-memo.ts");
let calls = 0;
const resolve = (user) => memoInRequest("user", async () => { calls++; await new Promise((done) => setTimeout(done, 5)); return user; });
const sessions = await Promise.all(["a", "b"].map((user) => withRequestMemo(async () => Promise.all([resolve(user), resolve(user), resolve(user)]))));
assert.equal(JSON.stringify(sessions), JSON.stringify([["a", "a", "a"], ["b", "b", "b"]]));
assert.equal(calls, 2, "Concurrent requests must not share users");
await withRequestMemo(() => resolve("new request"));
assert.equal(calls, 3);
await resolve("outside"); await resolve("outside");
assert.equal(calls, 5, "No caching outside request scope");
let attempts = 0;
await withRequestMemo(async () => {
  const fail = () => memoInRequest("failure", async () => { attempts++; throw new Error("offline"); });
  await assert.rejects(fail(), /offline/); await assert.rejects(fail(), /offline/);
});
await withRequestMemo(() => memoInRequest("failure", async () => { attempts++; return "recovered"; }));
assert.equal(attempts, 2);

const { loadDocumentRows } = load("src/lib/document-rows.ts");
for (const size of [21, 301, 2105]) {
  const rows = Array.from({ length: size }, (_, id) => ({ id }));
  let requests = 0;
  const result = await loadDocumentRows(async (from) => { requests++; return { data: rows.slice(from, from + 127), count: from === 0 ? size : null, error: null }; });
  assert.equal(result.data.length, size);
  assert.equal(new Set(result.data.map((row) => row.id)).size, size);
  assert.equal(requests, Math.ceil(size / 127));
}
await assert.rejects(loadDocumentRows(async () => ({ data: null, error: { message: "offline" } })), /offline/);
await assert.rejects(loadDocumentRows(async () => ({ data: [], count: 10, error: null })), /changed/);
const route = readFileSync("src/app/api/exports/route.ts", "utf8");
assert.equal((route.match(/\.auth\.getUser\(/g) || []).length, 1, "Only the request-scoped verifier should fetch the user");
assert.match(route, /Promise\.all\(\[recordDocumentGeneration\(report, format\), pdf\(report\)\]\)/);
assert.equal((route.match(/withRequestMemo\(\(\) => exportResponse/g) || []).length, 2, "Both GET and POST require a fresh scope");
console.log("ok - export request isolation, verified-user deduplication, error recovery, all document rows, and awaited history/PDF concurrency");
