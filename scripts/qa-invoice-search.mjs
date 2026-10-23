import assert from "node:assert/strict";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.SOLVA_QA_BASE_URL || "http://127.0.0.1:3101";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Use a local dev server for this fixture test.");
const route = new URL("../src/app/qa-invoice-search/", import.meta.url);
await mkdir(route, { recursive: true });
await copyFile(new URL("../tests/fixtures/invoice-search-page.tsx", import.meta.url), new URL("page.tsx", route));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/qa-invoice-search`);
  for (const label of ["Search Sales History", "Search pending invoices"]) {
    const search = page.getByRole("searchbox", { name: label, exact: true });
    const section = page.locator("section").filter({ has: search });
    for (const [query, count] of [["k", 4], ["ke", 3], ["ken", 2], ["ken mwangangi", 1], ["INV-2", 1], ["nobody", 0], ["", 6]]) {
      await search.fill(query);
      await page.waitForFunction(({ label, count }) => {
        const input = Array.from(document.querySelectorAll("input")).find((item) => item.getAttribute("aria-label") === label);
        return input.closest("section").querySelectorAll("article").length === count;
      }, { label, count });
      assert.equal(await section.locator("article").count(), count);
    }
    await search.fill("ken mwangangi");
    assert.equal(await section.getByRole("link", { name: "Invoice" }).getAttribute("href"), "/api/exports?invoiceId=0");
    assert.match(await section.innerText(), /KES 1000/);
    await section.getByRole("button", { name: `Clear ${label.toLowerCase()}` }).click();
    assert.equal(await section.locator("article").count(), 6);
    console.log(`ok - ${label}: immediate prefix filtering, case/accent matching, invoice search, amounts, links and clear`);
  }
  assert.equal(page.url(), `${base}/qa-invoice-search`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await rm(new URL("page.tsx", route));
}
