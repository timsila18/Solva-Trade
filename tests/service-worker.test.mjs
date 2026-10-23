import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const handlers = {};
let fetches = 0;
let writes = 0;
let cached;
let status = 200;
const deleted = [];
const cache = { match: async () => cached, put: async () => { writes++; }, addAll: async (assets) => {
  assert.equal(assets.includes("/dashboard"), false);
  assert.equal(assets.includes("/"), false);
} };
vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
  URL, self: { location: { origin: "https://solvatrade.co.ke" }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: () => {}, clients: { claim: () => {} } },
  caches: { open: async () => cache, keys: async () => ["solva-trade-shell-v1", "solva-trade-shell-v2", "unrelated-cache"], delete: async (name) => deleted.push(name) },
  fetch: async () => { fetches++; return new Response("static asset", { status }); },
});
async function request(path, method = "GET") {
  let response;
  const pending = [];
  handlers.fetch({ request: { method, url: `https://solvatrade.co.ke${path}` }, respondWith: (promise) => { response = promise; }, waitUntil: (promise) => pending.push(promise) });
  const result = await response;
  await Promise.all(pending);
  return result;
}
for (const path of ["/dashboard", "/sales", "/purchases", "/api/exports?format=pdf", "/api/search?q=ken"]) assert.equal(await request(path), undefined);
assert.equal(await request("/_next/static/app.js", "POST"), undefined);
assert.equal(fetches, 0);
console.log("ok - service worker never caches private business pages, searches, exports or mutations");
cached = new Response("cached static asset");
assert.equal(await (await request("/_next/static/app.js")).text(), "cached static asset");
assert.equal(fetches, 0);
cached = undefined;
await request("/_next/static/new.js");
assert.equal(fetches, 1);
assert.equal(writes, 1);
status = 500;
await request("/_next/static/missing.js");
assert.equal(writes, 1);
const pending = [];
handlers.install({ waitUntil: (promise) => pending.push(promise) });
handlers.activate({ waitUntil: (promise) => pending.push(promise) });
await Promise.all(pending);
assert.deepEqual(deleted, ["solva-trade-shell-v1"]);
console.log("ok - static cache avoids repeat downloads, rejects failed responses and removes only obsolete app caches");
