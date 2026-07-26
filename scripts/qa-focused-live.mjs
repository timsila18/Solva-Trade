import { chromium } from "@playwright/test";

const baseUrl = process.env.SOLVA_QA_BASE_URL || "https://www.solvatrade.co.ke";
const email = process.env.SOLVA_QA_EMAIL;
const password = process.env.SOLVA_QA_PASSWORD;
const routes = [
  "/dashboard",
  "/sales",
  "/sales/invoices",
  "/customers",
  "/customers/new",
  "/inventory/products",
  "/inventory/products/new",
  "/purchases/goods-received",
  "/reports",
  "/settings",
];
const exportChecks = [
  "/api/exports?module=Inventory&process=Product%20Master%20Report&format=pdf",
  "/api/exports?module=Inventory&process=Product%20Master%20Report&format=excel",
  "/api/exports?module=Sales&process=Invoice&format=pdf",
  "/api/exports?module=Sales&process=Sales%20Receipt&format=pdf",
  "/api/exports?module=Purchasing&process=Goods%20Received%20Note%20%28GRN%29&format=pdf",
  "/api/exports?module=Reports&process=Daily%20Report&format=pdf",
];

if (!email || !password) {
  console.error("Missing SOLVA_QA_EMAIL or SOLVA_QA_PASSWORD.");
  process.exit(1);
}

const failures = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

async function textSample() {
  return (await page.locator("body").innerText({ timeout: 10000 })).replace(/\s+/g, " ").slice(0, 240);
}

await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
console.log(`sign-in: ${page.url()}`);
await page.locator('input[type="email"], input[name*="email" i]').first().fill(email);
await page.locator('input[type="password"], input[name*="password" i]').first().fill(password);
await Promise.allSettled([
  page.waitForURL(/\/(dashboard|onboarding|account-inactive|no-business)\b/, { timeout: 30000 }),
  page.locator('button:has-text("Continue"), button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first().click(),
]);
await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
console.log(`after-login: ${page.url()}`);
console.log(`after-login-text: ${await textSample()}`);
if (/\/sign-in\b/.test(page.url())) failures.push("login stayed on sign-in");
if (/\/onboarding\b/.test(page.url())) failures.push("completed user was sent to onboarding");

for (const route of routes) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((error) => {
    failures.push(`${route}: navigation failed: ${error.message}`);
    return null;
  });
  await page.waitForTimeout(750);
  const status = response?.status() ?? 0;
  const url = page.url();
  const sample = await textSample().catch(() => "");
  console.log(`${route}: HTTP ${status} -> ${url} :: ${sample}`);
  if (status >= 400) failures.push(`${route}: HTTP ${status}`);
  if (/\/sign-in\b/.test(url)) failures.push(`${route}: redirected to sign-in`);
  if (/This page couldn't load|Application error|Action needs attention/i.test(sample)) failures.push(`${route}: visible error page`);
}

for (const route of exportChecks) {
  const response = await page.request.get(`${baseUrl}${route}`, { timeout: 30000 }).catch((error) => {
    failures.push(`${route}: export request failed: ${error.message}`);
    return null;
  });
  const status = response?.status() ?? 0;
  const contentType = response?.headers()["content-type"] ?? "";
  console.log(`${route}: HTTP ${status} ${contentType}`);
  if (status >= 400) failures.push(`${route}: HTTP ${status}`);
  if (!/pdf|spreadsheet|excel|csv|html/i.test(contentType)) failures.push(`${route}: unexpected content-type ${contentType}`);
}

await browser.close();

if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("\nFocused live QA passed.");
