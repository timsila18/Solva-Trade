import { chromium } from "@playwright/test";

const baseUrl = process.env.SOLVA_QA_BASE_URL || "https://solvatrade.co.ke";
const email = process.env.SOLVA_QA_EMAIL;
const password = process.env.SOLVA_QA_PASSWORD;

if (!email || !password) {
  console.error("Set SOLVA_QA_EMAIL and SOLVA_QA_PASSWORD before running this smoke test.");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];

page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(email);
  await page.locator('input[type="password"], input[name*="password" i]').first().fill(password);
  await Promise.allSettled([
    page.waitForURL(/\/(dashboard|onboarding|no-business|purchases)\b/, { timeout: 30000 }),
    page.locator('button:has-text("Continue"), button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first().click(),
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  if (/\/sign-in\b/.test(page.url())) throw new Error("Login did not reach an authenticated page.");

  await page.goto(`${baseUrl}/purchases/goods-received`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  if (/\/sign-in\b/.test(page.url())) throw new Error("Receive-stock page redirected to sign-in.");

  const search = page.locator('input[type="search"]').first();
  if ((await search.count()) > 0) await search.fill("tilapia");
  if ((await page.locator('input[name$="_unit_cost"]').count()) === 0 && (await search.count()) > 0) {
    await search.fill("");
  }

  const unitCostCount = await page.locator('input[name$="_unit_cost"]').count();
  if (!unitCostCount) {
    throw new Error(`No Unit cost fields found on ${page.url()}.\n${(await page.locator("body").innerText()).slice(0, 1000)}`);
  }

  const checkbox = page.locator('input[type="checkbox"][name^="field_line_"]').first();
  if ((await checkbox.count()) > 0) await checkbox.check({ timeout: 10000 }).catch(() => {});

  const unitCost = page.locator('input[name$="_unit_cost"]').first();
  await unitCost.click({ timeout: 10000 });
  await unitCost.fill("2000");
  const value = await unitCost.inputValue();
  if (value !== "2000") throw new Error(`Unit cost field did not retain 2000; received ${value || "(empty)"}.`);

  if (failures.length) throw new Error(failures.join("\n"));
  console.log("QA receive form smoke passed.");
} catch (error) {
  console.error(error);
  console.error(`Current URL: ${page.url()}`);
  console.error((await page.locator("body").innerText().catch(() => "")).slice(0, 1000));
  throw error;
} finally {
  await browser.close();
}
