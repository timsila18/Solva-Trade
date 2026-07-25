import { chromium } from "@playwright/test";

const baseUrl = process.env.SOLVA_QA_BASE_URL || "https://www.solvatrade.co.ke";
const email = process.env.SOLVA_QA_EMAIL;
const password = process.env.SOLVA_QA_PASSWORD;
const allowProductionWrites = process.env.SOLVA_QA_ALLOW_PRODUCTION_WRITES === "yes";
const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

if (!email || !password) {
  console.error("Missing SOLVA_QA_EMAIL or SOLVA_QA_PASSWORD.");
  process.exit(1);
}

if (!allowProductionWrites) {
  console.error("Refusing to create production QA records. Set SOLVA_QA_ALLOW_PRODUCTION_WRITES=yes only after explicit approval.");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const passed = [];

page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

function qaName(label) {
  return `QA Smoke ${label} ${suffix}`;
}

async function fillIfPresent(selector, value) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return false;
  await locator.fill(String(value));
  return true;
}

async function selectIfPresent(selector, value) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return false;
  await locator.selectOption({ label: value }).catch(async () => locator.selectOption(value));
  return true;
}

async function checkGeneratedDownloads(label) {
  const links = await page.locator('a:has-text("Download PDF"), a:has-text("Excel"), a:has-text("Export CSV")').evaluateAll((items) =>
    items.map((item) => ({ text: (item.textContent || "").trim(), href: item.href })),
  );
  if (!links.length) {
    failures.push(`${label}: no generated document download links found`);
    return;
  }
  for (const link of links) {
    const response = await page.request.get(link.href, { timeout: 20000 }).catch((error) => {
      failures.push(`${label}: ${link.text} request failed: ${error.message}`);
      return null;
    });
    const status = response?.status() ?? 0;
    if (status >= 400) failures.push(`${label}: ${link.text} returned HTTP ${status}`);
  }
}

async function assertComplete(label) {
  await page.waitForURL(/\/action-complete\b/, { timeout: 35000 });
  const body = await page.locator("body").innerText({ timeout: 10000 });
  if (/Action needs attention|Missing |could not|failed|error/i.test(body)) {
    failures.push(`${label}: completion page reported a problem: ${body.slice(0, 500)}`);
    return;
  }
  await checkGeneratedDownloads(label);
  passed.push(label);
}

async function clickSubmit(text) {
  await page.locator(`button:has-text("${text}")`).first().click();
}

async function login() {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(email);
  await page.locator('input[type="password"], input[name*="password" i]').first().fill(password);
  await Promise.allSettled([
    page.waitForURL(/\/(dashboard|onboarding)\b/, { timeout: 30000 }),
    page.locator('button:has-text("Continue"), button[type="submit"]').first().click(),
  ]);
  if (/\/sign-in\b/.test(page.url())) failures.push("login: credentials stayed on sign-in");
}

async function createCustomer() {
  const customer = qaName("Customer");
  await page.goto(`${baseUrl}/customers/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await fillIfPresent('[name="field_customer_name"]', customer);
  await fillIfPresent('[name="field_phone_number"]', "0700000001");
  await fillIfPresent('[name="field_town_or_area"]', "Nairobi QA");
  await fillIfPresent('[name="field_delivery_route"]', "QA Route");
  await clickSubmit("Save customer");
  await assertComplete("customer creation");
  return customer;
}

async function createSupplier() {
  const supplier = qaName("Supplier");
  await page.goto(`${baseUrl}/suppliers/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await fillIfPresent('[name="field_legal_name"]', supplier);
  await fillIfPresent('[name="field_trading_name"]', supplier);
  await fillIfPresent('[name="field_primary_phone"]', "0700000002");
  await fillIfPresent('[name="field_town"]', "Nairobi QA");
  await fillIfPresent('[name="field_supplier_category"]', "QA local market supplier");
  await fillIfPresent('[name="field_main_products"]', "QA beverages");
  await clickSubmit("Save supplier");
  await assertComplete("supplier creation");
  return supplier;
}

async function createProduct() {
  const product = qaName("Product");
  await page.goto(`${baseUrl}/inventory/products/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await fillIfPresent('[name="field_product_name"]', product);
  await fillIfPresent('[name="field_brand"]', "QA Brand");
  await fillIfPresent('[name="field_category"]', "QA Soft Drink");
  await selectIfPresent('[name="field_base_stock_unit"]', "Case");
  await fillIfPresent('[name="field_selling_price_placeholder"]', "120");
  await selectIfPresent('[name="field_vat_treatment"]', "VAT_STD");
  await page.locator('[name="field_create_opening_stock_after_save"]').check().catch(() => {});
  await fillIfPresent('[name="field_opening_stock_quantity"]', "10");
  await fillIfPresent('[name="field_opening_stock_unit_cost"]', "80");
  await clickSubmit("Save product");
  await assertComplete("product creation");
  return product;
}

async function receiveStock(product, supplier) {
  await page.goto(`${baseUrl}/purchases/goods-received`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await fillIfPresent('[name="field_grn_number"]', `QA-GRN-${suffix}`);
  await fillIfPresent('[name="field_po_number"]', `QA-PO-${suffix}`);
  await fillIfPresent('[name="field_supplier"]', supplier);
  await selectIfPresent('[name="field_source_type"]', "Local market supplier");
  await fillIfPresent('[name="field_source_reason"]', "QA process test");
  await fillIfPresent('[name="field_received_date"]', new Date().toISOString().slice(0, 10));
  await fillIfPresent('[name="field_product"]', product);
  await fillIfPresent('[name="field_received_quantity"]', "2");
  await fillIfPresent('[name="field_accepted_quantity"]', "2");
  await fillIfPresent('[name="field_rejected_quantity"]', "0");
  await fillIfPresent('[name="field_unit_cost"]', "82");
  await fillIfPresent('[name="field_batch"]', `QA-BATCH-${suffix}`);
  await clickSubmit("Post GRN and receive stock");
  await assertComplete("GRN stock receipt");
}

async function createSale(product, customer) {
  await page.goto(`${baseUrl}/sales/invoices`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await fillIfPresent('[name="field_invoice_number"]', `QA-INV-${suffix}`);
  await fillIfPresent('[name="field_customer"]', customer);
  await fillIfPresent('[name="field_sales_order"]', `QA-SO-${suffix}`);
  await fillIfPresent('[name="field_invoice_date"]', new Date().toISOString().slice(0, 10));
  await fillIfPresent('[name="field_due_date"]', new Date().toISOString().slice(0, 10));
  await fillIfPresent('[name="field_product"]', product);
  await fillIfPresent('[name="field_quantity"]', "1");
  await fillIfPresent('[name="field_unit_price"]', "150");
  await fillIfPresent('[name="field_discount"]', "0");
  await fillIfPresent('[name="field_amount_paid"]', "174");
  await clickSubmit("Submit");
  await assertComplete("sales invoice submission");
}

await login();
if (!failures.length) {
  const customer = await createCustomer();
  const supplier = await createSupplier();
  const product = await createProduct();
  await receiveStock(product, supplier);
  await createSale(product, customer);
}

await browser.close();

console.log("Process checks:");
for (const item of passed) console.log(`- passed: ${item}`);

if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("\nQA process smoke passed.");
