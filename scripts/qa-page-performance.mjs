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
  if (process.env.SOLVA_QA_DOCUMENTS === "yes") {
    const { data: membership, error: membershipError } = await admin.from("business_memberships").select("business_id").eq("user_id", link.user.id).eq("active", true).limit(1).single();
    if (membershipError) throw membershipError;
    for (const [table, key, processName] of [["sales_invoices", "invoiceId", "Invoice"], ["goods_received_notes", "grnId", "Goods Received Note (GRN)"]]) {
      const { data: rows, error: rowError } = await admin.from(table).select("id").eq("business_id", membership.business_id).order("created_at", { ascending: false }).limit(1);
      if (rowError) throw rowError;
      if (!rows.length) continue;
      const route = `/api/exports?${new URLSearchParams({ module: table === "sales_invoices" ? "Sales" : "Purchasing", process: processName, format: "pdf", [key]: rows[0].id })}`;
      const samples = [];
      for (let run = 0; run < Number(process.env.SOLVA_QA_RUNS || 3); run++) {
        const start = performance.now();
        const response = await fetch(`${base}${route}`, { headers: { Cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ") }, signal: AbortSignal.timeout(60000) });
        const body = Buffer.from(await response.arrayBuffer());
        assert.equal(response.status, 200, `${processName} status`);
        assert.equal(body.subarray(0, 5).toString(), "%PDF-", `${processName} PDF`);
        samples.push({ totalMs: Math.round(performance.now() - start), bytes: body.length });
      }
      console.log(JSON.stringify({ document: processName, documentId: rows[0].id, samples }));
    }
  }
} finally {
  // Revoke only this QA session, never the customer's other sessions.
  await client.auth.signOut({ scope: "local" });
}
