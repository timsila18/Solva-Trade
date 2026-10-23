import assert from "node:assert/strict";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.SOLVA_QA_BASE_URL || "http://127.0.0.1:3101";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Use a local dev server.");
const route = new URL("../src/app/qa-search-performance/", import.meta.url);
await mkdir(route, { recursive: true });
await copyFile(new URL("../tests/fixtures/search-performance-page.tsx", import.meta.url), new URL("page.tsx", route));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/qa-search-performance`);
  const directory = page.getByRole("searchbox", { name: "Search customers", exact: true });
  for (const [query, count] of [["k", 3], ["ke", 2], ["CUS-3", 1], ["", 5]]) {
    await directory.fill(query);
    assert.equal(await page.locator("article").count(), count);
  }
  await page.getByRole("searchbox", { name: "Search report customer", exact: true }).fill("ke");
  const select = page.getByRole("combobox", { name: "Report customer" });
  assert.equal(await select.locator("option").count(), 3);
  await select.selectOption("0");
  await page.getByRole("searchbox", { name: "Search report customer", exact: true }).fill("ah");
  assert.equal(await select.inputValue(), "0");
  const payload = await page.getByRole("form", { name: "report", exact: true }).evaluate((form) => Object.fromEntries(new FormData(form)));
  assert.equal(payload.customerId, "0");
  console.log("ok - live directories and searchable report selectors preserve selected record IDs");
  const workflow = page.getByRole("form", { name: "workflow", exact: true });
  await workflow.locator('[name="field_customer"]').fill("ke");
  assert.equal(await workflow.locator("#customer-options option").count(), 2);
  await workflow.locator('[name="field_customer"]').fill("Ken Mwangangi");
  await workflow.locator('[name="field_supplier"]').fill("k");
  assert.equal(await workflow.locator("#supplier-supplier-options option").count(), 1);
  await workflow.locator('[name="field_supplier"]').fill("Kenya Supplier");
  await workflow.locator('[name="field_product"]').fill("VAT");
  assert.equal(await workflow.locator("#product-options option").count(), 0);
  await workflow.locator('[name="field_product"]').fill("Product 1");
  await workflow.locator('[name="field_quantity"]').fill("12.5");
  assert.equal(await workflow.locator('[name="field_total"]').inputValue(), "11875.00");
  assert.equal(await workflow.locator('[name="field_product_id"]').inputValue(), "p1");
  assert.equal(await workflow.locator('[name="field_customer_id"]').inputValue(), "0");
  console.log("ok - workflow lookup selection and numeric calculations remain correct with 300 products");
  const catalogue = page.getByRole("region", { name: "catalogue", exact: true });
  await catalogue.locator('[name="price_0"]').fill("930");
  await catalogue.locator('[name="include_1"]').uncheck();
  await catalogue.getByPlaceholder("Search product, code or SKU", { exact: true }).fill("coke");
  assert.equal(await catalogue.locator("tbody tr:visible").count(), 1);
  await catalogue.getByPlaceholder("Search product, code or SKU", { exact: true }).fill("");
  assert.equal(await catalogue.locator("tbody tr:visible").count(), 3);
  assert.equal(await catalogue.locator('[name="price_0"]').inputValue(), "930");
  assert.equal(await catalogue.locator('[name="include_1"]').isChecked(), false);
  console.log("ok - catalogue searches immediately without losing custom prices or checked products");

  const requests = [];
  await page.route("**/api/search?*", async (requestRoute) => {
    const query = new URL(requestRoute.request().url()).searchParams.get("q");
    requests.push(query);
    if (query === "fail") return requestRoute.fulfill({ status: 503, json: { error: "Search is unavailable." } });
    if (query === "slow") await new Promise((resolve) => setTimeout(resolve, 650));
    await requestRoute.fulfill({ json: { results: [{ id: query, label: `Result ${query}`, hint: "Saved record", group: "Customers", href: "/customers" }], partial: false } }).catch(() => {});
  });
  await page.getByRole("button", { name: /Search customer, invoice/ }).click();
  const search = page.getByRole("searchbox", { name: "Search workspace records" });
  await search.pressSequentially("ken", { delay: 20 });
  await page.getByRole("link", { name: /Result ken/ }).waitFor();
  assert.deepEqual(requests, ["ken"]);
  await search.fill("slow");
  await page.waitForTimeout(300);
  await search.fill("ahmed");
  await page.getByRole("link", { name: /Result ahmed/ }).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.getByRole("link", { name: /Result slow/ }).count(), 0);
  await search.fill("fail");
  await page.getByText("Search is unavailable.", { exact: true }).waitFor();
  await search.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log("ok - workspace search debounces typing, rejects stale responses, displays failures and closes by keyboard");
} finally {
  await browser.close();
  await rm(new URL("page.tsx", route));
}
