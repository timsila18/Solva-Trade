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
  "/inventory",
  "/inventory/products",
  "/inventory/products/new",
  "/purchases",
  "/purchases/goods-received",
  "/suppliers",
  "/suppliers/new",
  "/cash-bank",
  "/cash-bank/expenses",
  "/accounting",
  "/accounting/chart-of-accounts",
  "/distribution",
  "/distribution/runs",
  "/financials",
  "/imports",
  "/insights",
  "/inventory/reports",
  "/notifications",
  "/reports",
  "/tax",
  "/billing",
  "/audit",
  "/team",
  "/settings",
  "/settings/branches",
  "/settings/warehouses",
  "/platform-admin",
  "/launch-readiness",
  "/support",
];

const destructivePatterns = /(delete|remove|archive|cancel|void|deactivate|sign out|logout|submit|post|save|create|receive|approve|dispatch|close|reset)/i;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const visited = [];

page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

async function checkPage(path) {
  console.log(`checking ${path}`);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 25000 }).catch((error) => {
    failures.push(`${path}: navigation failed: ${error.message}`);
    return null;
  });
  const status = response?.status() ?? 0;
  const url = page.url();
  visited.push(`${status} ${path} -> ${url}`);
  if (status >= 400) failures.push(`${path}: HTTP ${status}`);
  if (/\/sign-in\b/.test(url) && path !== "/sign-in") failures.push(`${path}: redirected to sign-in`);

  const controls = await page.locator("a,button").evaluateAll((items) =>
    items.map((item) => ({
      tag: item.tagName.toLowerCase(),
      text: (item.textContent || "").trim().replace(/\s+/g, " "),
      href: item instanceof HTMLAnchorElement ? item.href : "",
      disabled: item instanceof HTMLButtonElement ? item.disabled : item.getAttribute("aria-disabled") === "true",
      visible: !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length),
    })),
  );
  const brokenControls = controls.filter((control) => control.visible && !control.disabled && control.tag === "a" && !control.href && !control.text);
  if (brokenControls.length) failures.push(`${path}: ${brokenControls.length} visible anchor controls have no href/text`);

  const safeLinks = controls
    .filter((control) => control.visible && control.tag === "a" && control.href && control.href.startsWith(baseUrl) && !destructivePatterns.test(control.text))
    .slice(0, 5);
  for (const link of safeLinks) {
    const linkResponse = await page.request.get(link.href, { timeout: 10000 }).catch((error) => {
      failures.push(`${path}: link "${link.text || link.href}" failed: ${error.message}`);
      return null;
    });
    const linkStatus = linkResponse?.status() ?? 0;
    if (linkStatus >= 500) failures.push(`${path}: link "${link.text || link.href}" returned HTTP ${linkStatus}`);
  }
}

await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
if (email && password) {
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(email);
  await page.locator('input[type="password"], input[name*="password" i]').first().fill(password);
  const loginButton = page.locator('button:has-text("Continue"), button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first();
  await Promise.allSettled([
    page.waitForURL(/\/(dashboard|onboarding)\b/, { timeout: 30000 }),
    loginButton.click(),
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  if (/\/sign-in\b/.test(page.url())) {
    failures.push("login: credentials did not reach an authenticated page");
  }
} else {
  failures.push("login: skipped because SOLVA_QA_EMAIL/SOLVA_QA_PASSWORD were not provided");
}

for (const route of routes) {
  await checkPage(route);
}

await browser.close();

console.log("Visited routes:");
for (const line of visited) console.log(`- ${line}`);

if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}

console.log("\nQA smoke passed.");
