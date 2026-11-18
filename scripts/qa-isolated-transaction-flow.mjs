import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";

process.loadEnvFile(".env.local");
assert.equal(process.env.SOLVA_QA_ISOLATED_WRITES, "yes", "Explicitly enable isolated QA workspace writes.");
const base = process.env.SOLVA_QA_BASE_URL || "https://solvatrade.co.ke";
const runId = randomUUID();
const businessName = `ISOLATED QA FLOW ${runId}`;
const email = `qa-flow-${runId}@example.invalid`;
const password = `${randomUUID()}Aa9!`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
let userId, businessId, browser, client;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Isolated QA Operator" } });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;
  const business = await checked(admin.from("businesses").insert({ legal_name: businessName, trading_name: businessName, created_by: userId, onboarding_status: "complete" }).select("id").single());
  businessId = business.id;
  console.log(`QA workspace: ${businessId}`);
  await checked(admin.from("business_memberships").insert({ user_id: userId, business_id: businessId, role: "owner", active: true }));
  const updated = await admin.auth.admin.updateUserById(userId, { app_metadata: { active_business_id: businessId, business_role: "owner", business_name: businessName } });
  if (updated.error) throw new Error(updated.error.message);
  const supplier = await checked(admin.from("suppliers").insert({ business_id: businessId, legal_name: "QA Supplier", trading_name: "QA Supplier", supplier_code: "QA-SUP", status: "approved", created_by: userId }).select("id").single());
  const products = await checked(admin.from("products").insert(Array.from({ length: 21 }, (_, index) => ({ business_id: businessId, product_name: `QA FLOW PRODUCT ${String(index + 1).padStart(2, "0")}`, product_code: `QA-FLOW-${index + 1}`, sku: `QA-FLOW-${index + 1}`, standard_cost: 999, default_selling_price_placeholder: 150, vat_status: "VAT_STD", created_by: userId }))).select("id,product_name"));
  const jar = new Map();
  client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => Array.from(jar.values()), setAll: (cookies) => cookies.forEach((cookie) => jar.set(cookie.name, cookie)) } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(signedIn.error.message);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(Array.from(jar.values(), (cookie) => ({ name: cookie.name, value: cookie.value, url: base, sameSite: "Lax" })));
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  async function complete(buttonName) {
    const start = performance.now();
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    await page.waitForURL(/\/action-complete\?/, { timeout: 90000 });
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get("error"), null, params.get("error") || "Posting failed");
    await page.getByRole("link", { name: "Download PDF", exact: true }).waitFor();
    console.log(JSON.stringify({ step: buttonName, submitMs: Math.round(performance.now() - start) }));
    return params;
  }
  async function documentCheck(path, label, requireAllProducts = true) {
    const start = performance.now();
    const response = await context.request.get(new URL(path, base).href, { timeout: 90000 });
    assert.equal(response.status(), 200, `${label} HTTP status`);
    assert.ok(response.headers()["content-type"].includes("pdf"), `${label} must be PDF`);
    const pdf = await response.body();
    console.log(JSON.stringify({ step: `${label} PDF`, totalMs: Math.round(performance.now() - start) }));
    assert.ok(pdf.subarray(0, 5).toString() === "%PDF-");
    if (requireAllProducts) {
      const htmlUrl = new URL(path, base); htmlUrl.searchParams.set("format", "print");
      const html = await context.request.get(htmlUrl.href, { timeout: 90000 });
      assert.equal(html.status(), 200);
      const text = await html.text();
      for (const product of products) assert.ok(text.includes(product.product_name), `${label}: missing ${product.product_name}`);
      const pdfText = pdf.toString("latin1");
      if (pdfText.includes("QA FLOW PRODUCT")) for (const product of products) assert.ok(pdfText.includes(product.product_name), `${label}: missing PDF row ${product.product_name}`);
    }
    console.log(`PASS ${label}: PDF ${pdf.length} bytes${requireAllProducts ? ", all 21 product rows in print output" : ""}`);
  }
  await page.goto(`${base}/purchases/goods-received`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('[name="field_supplier_id"]').selectOption(supplier.id);
  for (let index = 0; index < 21; index++) {
    await page.locator(`[name="field_line_${index}_quantity"]`).fill("10");
    await page.locator(`[name="field_line_${index}_unit_cost"]`).fill("100");
  }
  const grn = await complete("Receive stock and generate GRN");
  assert.ok(grn.get("grnId"), "Posted GRN ID");
  const balances = await checked(admin.from("stock_balances").select("product_id,available_quantity").eq("business_id", businessId));
  assert.equal(balances.length, 21);
  balances.forEach((row) => assert.equal(Number(row.available_quantity), 10));
  console.log("PASS receiving: 21 rows posted; stock is 10 for every product");
  await documentCheck(await page.getByRole("link", { name: "Download PDF", exact: true }).getAttribute("href"), "GRN");
  await page.goto(`${base}/sales/invoices`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByPlaceholder("Or type new customer name and continue", { exact: true }).fill("QA FLOW CUSTOMER");
  for (let index = 0; index < 21; index++) {
    await page.locator(`[name="field_line_${index}_quantity"]`).fill("2");
    await page.locator(`[name="field_line_${index}_unit_price"]`).fill("150");
  }
  await page.getByRole("button", { name: "Preview sale", exact: true }).click();
  const sale = await complete("Create invoice");
  const invoiceId = sale.get("invoiceId");
  assert.ok(invoiceId, "Posted invoice ID");
  const invoice = await checked(admin.from("sales_invoices").select("id,total_amount,balance_due,amount_paid,customer_id").eq("business_id", businessId).eq("id", invoiceId).single());
  assert.equal(Number(invoice.total_amount), 6300);
  assert.equal(Number(invoice.balance_due), 6300);
  const items = await checked(admin.from("sales_invoice_items").select("id,line_total").eq("business_id", businessId).eq("invoice_id", invoiceId));
  assert.equal(items.length, 21);
  const remaining = await checked(admin.from("stock_balances").select("product_id,available_quantity").eq("business_id", businessId));
  remaining.forEach((row) => assert.equal(Number(row.available_quantity), 8));
  const allocations = await checked(admin.from("sales_source_allocations").select("unit_cost,total_cost,quantity").eq("business_id", businessId).eq("sales_invoice_id", invoiceId));
  assert.equal(allocations.length, 21);
  allocations.forEach((row) => assert.equal(Number(row.unit_cost), 100, "FIFO must use received cost, not product cost 999"));
  assert.equal(allocations.reduce((sum, row) => sum + Number(row.total_cost), 0), 4200);
  console.log("PASS sale: 21 invoice lines, total/balance 6300, stock 8, FIFO receipt cost 100");
  await documentCheck(await page.getByRole("link", { name: "Download PDF", exact: true }).getAttribute("href"), "Invoice");
  await page.goto(`${base}/sales`, { waitUntil: "networkidle", timeout: 60000 });
  const pending = page.locator("article").filter({ has: page.getByRole("heading", { name: (await checked(admin.from("sales_invoices").select("invoice_number").eq("id", invoiceId).single())).invoice_number, exact: true }) });
  assert.equal(await pending.count(), 1, "Sale must appear once in pending payment queue");
  assert.deepEqual(runtimeErrors, []);
  console.log("PASS live submit-to-database-to-PDF flow; no browser runtime errors");
} finally {
  if (browser) await browser.close();
  if (client) await client.auth.signOut({ scope: "local" });
  // Keep immutable posted QA records isolated and auditable; never delete posted movements.
  if (businessId) {
    await checked(admin.from("businesses").update({ active: false }).eq("id", businessId).eq("trading_name", businessName).eq("created_by", userId));
    console.log(`QA workspace retired: ${businessId}; no live tenant records changed`);
  }
  if (userId) {
    const result = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (result.error) throw new Error(`Could not disable QA login: ${result.error.message}`);
  }
}
