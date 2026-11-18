import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(".env.local");
const base = process.env.SOLVA_QA_BASE_URL || "https://solvatrade.co.ke";
const email = process.env.SOLVA_QA_EMAIL;
assert.ok(email, "Set SOLVA_QA_EMAIL to an authorized existing test account.");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (linkError) throw new Error(linkError.message);
const jar = new Map();
const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)) },
});
const { error } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
if (error) throw new Error(error.message);
try {
  for (const route of ["/dashboard", "/sales", "/sales/invoices", "/purchases/goods-received"]) {
    const samples = [];
    for (let run = 0; run < Number(process.env.SOLVA_QA_RUNS || 3); run++) {
      const start = performance.now();
      const response = await fetch(`${base}${route}`, { headers: { Cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ") }, signal: AbortSignal.timeout(60000) });
      const firstByte = performance.now() - start;
      const body = await response.text();
      assert.equal(response.status, 200, `${route} HTTP ${response.status}`);
      assert.ok(body.includes("Logged in as"), `${route} must use an authenticated session`);
      assert.ok(!/This page couldn&#x27;t load|Application error/.test(body), `${route} returned an error page`);
      samples.push({ ttfbMs: Math.round(firstByte), totalMs: Math.round(performance.now() - start), bytes: Buffer.byteLength(body), region: response.headers.get("x-vercel-id")?.split("::").slice(0, 2).join("::") });
    }
    console.log(JSON.stringify({ route, samples }));
  }
} finally {
  // Revoke only this QA session, never the customer's other sessions.
  await client.auth.signOut({ scope: "local" });
}
