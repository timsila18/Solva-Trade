import assert from "node:assert/strict";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.SOLVA_QA_BASE_URL || "http://127.0.0.1:3101";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("This fixture test runs only against a local dev server.");
const route = new URL("../src/app/qa-number-entry/", import.meta.url);
const fixture = new URL("../tests/fixtures/transaction-input-page.tsx", import.meta.url);
await mkdir(route, { recursive: true });
await copyFile(fixture, new URL("page.tsx", route));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}/qa-number-entry`);
  for (const mode of ["sale", "goods-received"]) {
    if (mode === "goods-received") await page.getByRole("button", { name: "Switch mode" }).click();
    const field = (index, suffix) => page.locator(`[name="field_line_${index}_${suffix}"]`);
    const priceSuffix = mode === "sale" ? "unit_price" : "unit_cost";
    await field(0, "quantity").pressSequentially("12.5", { delay: 25 });
    assert.equal(await field(0, "quantity").inputValue(), "12.5");
    await field(0, priceSuffix).fill("");
    await field(0, priceSuffix).pressSequentially("930.50", { delay: 25 });
    assert.equal(await field(0, priceSuffix).inputValue(), "930.50");
    assert.equal(await field(0, "selected").isChecked(), true);
    await field(1, "quantity").fill("2");
    await field(1, priceSuffix).fill("100");
    assert.equal(await page.locator('[name="field_total"]').inputValue(), "11831.25");
    await field(0, priceSuffix).focus();
    await field(0, priceSuffix).dispatchEvent("wheel", { deltaY: 100 });
    assert.equal(await field(0, priceSuffix).inputValue(), "930.50");
    await field(0, "selected").uncheck();
    assert.equal(await page.locator('[name="field_total"]').inputValue(), "200.00");
    await field(0, "selected").check();
    const search = page.locator('input[type="search"]');
    await search.nth(mode === "sale" ? 2 : 1).fill("SKU-299");
    await search.nth(mode === "sale" ? 2 : 1).fill("");
    assert.equal(await field(0, "quantity").inputValue(), "12.5");
    await page.waitForTimeout(350);
    await page.reload();
    if (mode === "goods-received") await page.getByRole("button", { name: "Switch mode" }).click();
    await page.waitForFunction(() => document.querySelector('[name="field_line_0_quantity"]')?.value === "12.5");
    assert.equal(await field(0, priceSuffix).inputValue(), "930.50");
    assert.equal(await page.locator('[name="field_total"]').inputValue(), "11831.25");
    const payload = await page.locator("form").evaluate((form) => Object.fromEntries(new FormData(form)));
    assert.equal(payload.field_total, "11831.25");
    assert.equal(payload.field_line_0_line_total, "11631.25");
    assert.equal(payload.field_line_1_line_total, "200.00");
    assert.equal(payload.field_line_299_product_id, undefined);
    console.log(`ok - ${mode}: typing, decimals, totals, selection, search, wheel protection and draft restore with 300 products`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await rm(new URL("page.tsx", route));
}
