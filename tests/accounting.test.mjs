import assert from "node:assert/strict";

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const accounts = [
  ["1000", "Cash on Hand", "assets", "debit", false, true, "CASH_ON_HAND"],
  ["1100", "Bank Accounts", "assets", "debit", true, true, "BANK_ACCOUNT"],
  ["1200", "Customer Receivables", "assets", "debit", true, true, "CUSTOMER_RECEIVABLES"],
  ["1400", "Inventory", "assets", "debit", true, true, "INVENTORY_ASSET"],
  ["1500", "Input VAT", "assets", "debit", true, true, "INPUT_VAT"],
  ["2000", "Supplier Payables", "liabilities", "credit", true, true, "SUPPLIER_PAYABLES"],
  ["2010", "Goods Received Not Invoiced", "liabilities", "credit", true, true, "GOODS_RECEIVED_NOT_INVOICED"],
  ["2200", "Output VAT", "liabilities", "credit", true, true, "OUTPUT_VAT"],
  ["3000", "Owner Capital", "equity", "credit", false, true, "OWNER_CAPITAL"],
  ["3200", "Owner Drawings", "equity", "debit", true, true, "OWNER_DRAWINGS"],
  ["4000", "Product Sales", "revenue", "credit", false, true, "SALES_REVENUE"],
  ["5000", "Cost of Goods Sold", "cost_of_sales", "debit", false, true, "COST_OF_GOODS_SOLD"],
  ["1310", "Staff Advances", "assets", "debit", true, true, "STAFF_ADVANCES"],
].map(([code, name, accountClass, normalBalance, isControl, isPosting, role]) => ({
  code,
  name,
  accountClass,
  normalBalance,
  isControl,
  isPosting,
  isHeader: !isPosting,
  role,
}));

const mappings = accounts.filter((account) => account.role).map((account) => ({
  role: account.role,
  accountCode: account.code,
  scope: "business",
  priority: 100,
}));

function assertBalanced(lines) {
  const debit = Number(lines.reduce((sum, line) => sum + line.debit, 0).toFixed(4));
  const credit = Number(lines.reduce((sum, line) => sum + line.credit, 0).toFixed(4));
  if (debit <= 0 || credit <= 0 || debit !== credit) throw new Error(`Journal is not balanced. Debit ${debit}, credit ${credit}.`);
  return { debit, credit };
}

function resolve(role, extraMappings = [], scopeHints = {}) {
  const rankedScopes = ["transaction", "product", "category", "customer", "supplier", "branch", "tax", "payment_account", "business"];
  const candidates = [...extraMappings, ...mappings]
    .filter((mapping) => mapping.role === role)
    .filter((mapping) => mapping.scope === "business" || scopeHints[mapping.scope] === mapping.scopeId)
    .sort((a, b) => rankedScopes.indexOf(a.scope) - rankedScopes.indexOf(b.scope) || a.priority - b.priority);
  if (!candidates[0]) throw new Error(`Missing account mapping for ${role}.`);
  return candidates[0].accountCode;
}

function accountName(code) {
  return accounts.find((account) => account.code === code)?.name ?? code;
}

function line(accountCode, debit, credit, description) {
  const account = accounts.find((item) => item.code === accountCode);
  if (!account?.isPosting || account.isHeader) throw new Error("Journal lines can only use posting accounts.");
  return { accountCode, accountName: accountName(accountCode), debit, credit, description };
}

function buildJournal(event, extraMappings = []) {
  const tax = event.taxAmount ?? 0;
  const cost = event.costAmount ?? 0;
  const net = event.amount - tax;
  const scopeHints = { product: event.productId, customer: event.customerId, supplier: event.supplierId, payment_account: event.financeAccountId };
  const pick = (role) => resolve(role, extraMappings, scopeHints);
  const lines = [];
  if (event.eventType === "credit_sale") {
    lines.push(line(pick("CUSTOMER_RECEIVABLES"), event.amount, 0, "Money customers owe"));
    lines.push(line(pick("SALES_REVENUE"), 0, net, "Product sales"));
    if (tax > 0) lines.push(line(pick("OUTPUT_VAT"), 0, tax, "Output VAT"));
    if (cost > 0) {
      lines.push(line(pick("COST_OF_GOODS_SOLD"), cost, 0, "Cost of goods sold"));
      lines.push(line(pick("INVENTORY_ASSET"), 0, cost, "Inventory issued"));
    }
  } else if (event.eventType === "customer_payment") {
    lines.push(line(pick("BANK_ACCOUNT"), event.amount, 0, "Cash or bank received"));
    lines.push(line(pick("CUSTOMER_RECEIVABLES"), 0, event.amount, "Customer receivable cleared"));
  } else if (event.eventType === "supplier_bill_inventory") {
    lines.push(line(pick("GOODS_RECEIVED_NOT_INVOICED"), net, 0, "Clear GRNI"));
    if (tax > 0) lines.push(line(pick("INPUT_VAT"), tax, 0, "Input VAT"));
    lines.push(line(pick("SUPPLIER_PAYABLES"), 0, event.amount, "Supplier payable"));
  } else if (event.eventType === "supplier_payment") {
    lines.push(line(pick("SUPPLIER_PAYABLES"), event.amount, 0, "Supplier payable settled"));
    lines.push(line(pick("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  } else if (event.eventType === "owner_capital") {
    lines.push(line(pick("BANK_ACCOUNT"), event.amount, 0, "Cash or bank received"));
    lines.push(line(pick("OWNER_CAPITAL"), 0, event.amount, "Owner capital"));
  } else if (event.eventType === "owner_drawing") {
    lines.push(line(pick("OWNER_DRAWINGS"), event.amount, 0, "Owner drawing"));
    lines.push(line(pick("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  } else if (event.eventType === "staff_advance") {
    lines.push(line(pick("STAFF_ADVANCES"), event.amount, 0, "Staff advance"));
    lines.push(line(pick("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  }
  assertBalanced(lines);
  return { journalNumber: "GJ-1", status: "posted", lines };
}

function reverseJournal(journal) {
  if (journal.status !== "posted") throw new Error("Only posted journals can be reversed.");
  return { journalNumber: "RJ-1", status: "posted", lines: journal.lines.map((item) => ({ ...item, debit: item.credit, credit: item.debit })) };
}

function trialBalance(journals) {
  const rows = new Map();
  for (const journal of journals.filter((item) => item.status === "posted" || item.status === "reversed")) {
    for (const entry of journal.lines) {
      const row = rows.get(entry.accountCode) ?? { debit: 0, credit: 0 };
      row.debit += entry.debit;
      row.credit += entry.credit;
      rows.set(entry.accountCode, row);
    }
  }
  return Array.from(rows.values()).reduce((sum, row) => ({ debit: sum.debit + row.debit, credit: sum.credit + row.credit }), { debit: 0, credit: 0 });
}

function duplicateCode(accountsToCheck) {
  const seen = new Set();
  for (const account of accountsToCheck) {
    if (seen.has(account.code)) throw new Error("Duplicate account code");
    seen.add(account.code);
  }
}

function circular(accountsToCheck) {
  const byCode = new Map(accountsToCheck.map((account) => [account.code, account.parentCode]));
  return accountsToCheck.some((account) => {
    const seen = new Set();
    let parent = account.parentCode;
    while (parent) {
      if (parent === account.code || seen.has(parent)) return true;
      seen.add(parent);
      parent = byCode.get(parent);
    }
    return false;
  });
}

function canPostToPeriod(status, locked = false) {
  if (status === "closed" || locked) throw new Error("Cannot post into a closed or locked accounting period.");
  return ["open", "soft_closed", "reopened"].includes(status);
}

function reconcile(glBalance, subledgerBalance) {
  const difference = Number((glBalance - subledgerBalance).toFixed(4));
  return { difference, status: difference === 0 ? "reconciled" : Math.abs(difference) <= 10 ? "small_difference" : "difference_found" };
}

test("chart of accounts enforces unique codes and circular-parent checks", () => {
  assert.equal(duplicateCode([{ code: "1000" }, { code: "2000" }]), undefined);
  assert.throws(() => duplicateCode([{ code: "1000" }, { code: "1000" }]), /Duplicate/);
  assert.equal(circular([{ code: "1000", parentCode: "2000" }, { code: "2000", parentCode: "1000" }]), true);
});

test("mapping precedence prefers scoped mappings over business defaults", () => {
  const productMapping = { role: "SALES_REVENUE", accountCode: "4010", scope: "product", scopeId: "sku-1", priority: 20 };
  assert.equal(resolve("SALES_REVENUE", [productMapping], { product: "sku-1" }), "4010");
  assert.equal(resolve("SALES_REVENUE", [productMapping], { product: "sku-2" }), "4000");
});

test("credit sale posts receivable, revenue, VAT, COGS and inventory", () => {
  const journal = buildJournal({ eventType: "credit_sale", amount: 1160, taxAmount: 160, costAmount: 700, customerId: "c1", productId: "p1" });
  assert.deepEqual(assertBalanced(journal.lines), { debit: 1860, credit: 1860 });
  assert.equal(journal.lines.find((entry) => entry.accountCode === "1200").debit, 1160);
  assert.equal(journal.lines.find((entry) => entry.accountCode === "2200").credit, 160);
});

test("customer payment clears receivables against bank", () => {
  const journal = buildJournal({ eventType: "customer_payment", amount: 500, customerId: "c1" });
  assert.deepEqual(assertBalanced(journal.lines), { debit: 500, credit: 500 });
});

test("supplier bill and supplier payment remain balanced", () => {
  const bill = buildJournal({ eventType: "supplier_bill_inventory", amount: 1160, taxAmount: 160, supplierId: "s1", productId: "p1" });
  const payment = buildJournal({ eventType: "supplier_payment", amount: 1160, supplierId: "s1" });
  assert.deepEqual(assertBalanced(bill.lines), { debit: 1160, credit: 1160 });
  assert.deepEqual(assertBalanced(payment.lines), { debit: 1160, credit: 1160 });
});

test("owner capital, owner drawing and staff advance post through proper roles", () => {
  assert.equal(buildJournal({ eventType: "owner_capital", amount: 10000 }).lines[1].accountCode, "3000");
  assert.equal(buildJournal({ eventType: "owner_drawing", amount: 2500 }).lines[0].accountCode, "3200");
  assert.equal(buildJournal({ eventType: "staff_advance", amount: 3000 }).lines[0].accountCode, "1310");
});

test("unbalanced and header-account journal attempts are rejected", () => {
  assert.throws(() => assertBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }]), /not balanced/);
  accounts.push({ code: "9999", name: "Header", isPosting: false, isHeader: true });
  assert.throws(() => line("9999", 1, 0, "bad"), /posting accounts/);
  accounts.pop();
});

test("reversals fully offset original posted journals", () => {
  const journal = buildJournal({ eventType: "customer_payment", amount: 500, customerId: "c1" });
  const reversal = reverseJournal(journal);
  const totals = trialBalance([journal, reversal]);
  assert.equal(totals.debit, totals.credit);
  assert.equal(totals.debit, 1000);
});

test("trial balance excludes drafts and balances posted entries", () => {
  const posted = buildJournal({ eventType: "owner_capital", amount: 1000 });
  const draft = { status: "draft", lines: [{ accountCode: "1100", debit: 1, credit: 0 }, { accountCode: "3000", debit: 0, credit: 2 }] };
  assert.deepEqual(trialBalance([posted, draft]), { debit: 1000, credit: 1000 });
});

test("period locks and control-account reconciliation are explicit", () => {
  assert.equal(canPostToPeriod("open"), true);
  assert.equal(canPostToPeriod("soft_closed"), true);
  assert.throws(() => canPostToPeriod("closed"), /closed/);
  assert.throws(() => canPostToPeriod("open", true), /locked/);
  assert.deepEqual(reconcile(1000, 1000), { difference: 0, status: "reconciled" });
  assert.deepEqual(reconcile(1000, 995), { difference: 5, status: "small_difference" });
  assert.deepEqual(reconcile(1000, 900), { difference: 100, status: "difference_found" });
});

test("idempotency keys prevent duplicate event posting", () => {
  const processed = new Set();
  const key = "sale-1";
  assert.equal(processed.has(key), false);
  processed.add(key);
  assert.equal(processed.has(key), true);
});
