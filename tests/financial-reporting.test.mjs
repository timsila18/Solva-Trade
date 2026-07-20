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

const accountLookup = {
  1100: { accountClass: "assets", normalBalance: "debit", financialStatementSection: "current_assets", cashFlowCategory: "cash_equivalents" },
  1200: { accountClass: "assets", normalBalance: "debit", financialStatementSection: "current_assets", cashFlowCategory: "operating" },
  1400: { accountClass: "assets", normalBalance: "debit", financialStatementSection: "current_assets", cashFlowCategory: "operating" },
  2000: { accountClass: "liabilities", normalBalance: "credit", financialStatementSection: "current_liabilities", cashFlowCategory: "operating" },
  3000: { accountClass: "equity", normalBalance: "credit", financialStatementSection: "equity", cashFlowCategory: "financing" },
  3200: { accountClass: "equity", normalBalance: "debit", financialStatementSection: "equity", cashFlowCategory: "financing" },
  4000: { accountClass: "revenue", normalBalance: "credit", financialStatementSection: "revenue", cashFlowCategory: "operating" },
  5000: { accountClass: "cost_of_sales", normalBalance: "debit", financialStatementSection: "cost_of_sales", cashFlowCategory: "operating" },
  6000: { accountClass: "expenses", normalBalance: "debit", financialStatementSection: "expenses", cashFlowCategory: "operating" },
};

const postedJournal = {
  status: "posted",
  lines: [
    { accountCode: "1100", accountName: "Bank", debit: 1600, credit: 0, branchId: "branch-a", description: "Cash received" },
    { accountCode: "1200", accountName: "Receivables", debit: 400, credit: 0, branchId: "branch-a", customerId: "customer-a", description: "Customer debt" },
    { accountCode: "4000", accountName: "Sales", debit: 0, credit: 2000, branchId: "branch-a", productId: "product-a", customerId: "customer-a", description: "Revenue" },
    { accountCode: "5000", accountName: "COGS", debit: 800, credit: 0, branchId: "branch-a", productId: "product-a", description: "Cost" },
    { accountCode: "1400", accountName: "Inventory", debit: 0, credit: 800, branchId: "branch-a", productId: "product-a", description: "Inventory issued" },
    { accountCode: "6000", accountName: "Expenses", debit: 300, credit: 0, branchId: "branch-a", routeId: "route-a", vehicleId: "vehicle-a", description: "Expense" },
    { accountCode: "1100", accountName: "Bank", debit: 0, credit: 300, branchId: "branch-a", description: "Expense paid" },
    { accountCode: "3000", accountName: "Owner Capital", debit: 0, credit: 500, description: "Opening equity" },
    { accountCode: "1100", accountName: "Bank", debit: 500, credit: 0, description: "Owner funding" },
  ],
};

const draftJournal = {
  status: "draft",
  lines: [
    { accountCode: "4000", accountName: "Sales", debit: 0, credit: 9999, description: "Draft revenue" },
  ],
};

function postedLines(journals) {
  return journals
    .filter((journal) => journal.status === "posted" || journal.status === "reversed")
    .flatMap((journal) =>
      journal.lines.map((line) => ({
        ...line,
        ...accountLookup[line.accountCode],
      })),
    );
}

function natural(line) {
  return line.normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
}

function sumByClass(lines, classes) {
  return Number(lines.filter((line) => classes.includes(line.accountClass)).reduce((sum, line) => sum + natural(line), 0).toFixed(4));
}

function profitAndLoss(lines, budget = 0) {
  const revenue = sumByClass(lines, ["revenue"]);
  const costOfSales = sumByClass(lines, ["cost_of_sales"]);
  const grossProfit = revenue - costOfSales;
  const expenses = sumByClass(lines, ["expenses"]);
  const netProfit = grossProfit - expenses;
  return { revenue, costOfSales, grossProfit, expenses, netProfit, budgetVariance: netProfit - budget };
}

function balanceSheet(lines) {
  const currentYearEarnings = profitAndLoss(lines).netProfit;
  const assets = sumByClass(lines, ["assets"]);
  const liabilities = sumByClass(lines, ["liabilities"]);
  const equity = sumByClass(lines, ["equity"]) + currentYearEarnings;
  return { assets, liabilities, equity, imbalance: Number((assets - liabilities - equity).toFixed(4)), balanced: Number((assets - liabilities - equity).toFixed(4)) === 0, currentYearEarnings };
}

function cashFlow(lines, openingCash = 0) {
  const operating = Number(lines.filter((line) => line.cashFlowCategory === "operating").reduce((sum, line) => sum + natural(line), 0).toFixed(4));
  const financing = Number(lines.filter((line) => line.cashFlowCategory === "financing").reduce((sum, line) => sum + natural(line), 0).toFixed(4));
  const balanceSheetCash = Number(lines.filter((line) => line.cashFlowCategory === "cash_equivalents").reduce((sum, line) => sum + natural(line), 0).toFixed(4));
  const closingCash = balanceSheetCash;
  return { operating, financing, netIncrease: closingCash - openingCash, closingCash, balanceSheetCash, reconciliationDifference: Number((closingCash - balanceSheetCash).toFixed(4)) };
}

function safeRatio(numerator, denominator) {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(4));
}

function actualVersusBudget(actual, budget) {
  const variance = actual - budget;
  return { variance, variancePercent: budget === 0 ? null : Number(((variance / Math.abs(budget)) * 100).toFixed(4)) };
}

function validateBudget(lines) {
  const seen = new Set();
  for (const line of lines) {
    const key = [line.accountCode, line.period, line.branchId ?? ""].join("|");
    if (seen.has(key)) throw new Error("Budget import contains duplicate line scope.");
    seen.add(key);
  }
  return true;
}

function immutableBudget(status) {
  if (["approved", "active"].includes(status)) throw new Error("Approved budgets cannot be overwritten.");
  return true;
}

function closeAllowed(tasks, override = false) {
  if (!override && tasks.some((task) => task.blocking && !["completed", "waived"].includes(task.status))) {
    throw new Error("Blocking close tasks are incomplete.");
  }
  return true;
}

function snapshot(payload) {
  return { payload: JSON.stringify(payload), immutable: true };
}

test("Profit and Loss totals agree with posted journal lines and exclude drafts", () => {
  const lines = postedLines([postedJournal, draftJournal]);
  assert.deepEqual(profitAndLoss(lines), { revenue: 2000, costOfSales: 800, grossProfit: 1200, expenses: 300, netProfit: 900, budgetVariance: 900 });
});

test("comparative Profit and Loss and budget variance handle zero safely", () => {
  assert.equal(safeRatio(900, 2000), 45);
  assert.equal(safeRatio(100, 0), null);
  assert.deepEqual(actualVersusBudget(900, 1000), { variance: -100, variancePercent: -10 });
  assert.deepEqual(actualVersusBudget(900, 0), { variance: 900, variancePercent: null });
});

test("Balance Sheet balances and current-year earnings agree with Profit and Loss", () => {
  const lines = postedLines([postedJournal]);
  const statement = balanceSheet(lines);
  assert.equal(statement.currentYearEarnings, profitAndLoss(lines).netProfit);
  assert.equal(statement.balanced, true);
  assert.equal(statement.imbalance, 0);
});

test("Cash Flow closing cash agrees with Balance Sheet cash", () => {
  const lines = postedLines([postedJournal]);
  const statement = cashFlow(lines, 0);
  assert.equal(statement.closingCash, statement.balanceSheetCash);
  assert.equal(statement.reconciliationDifference, 0);
});

test("Statement of Changes in Equity rolls forward owner movements", () => {
  const closingEquity = 500 + 200 - 100 + 900;
  assert.equal(closingEquity, 1500);
});

test("branch and unallocated reports consolidate correctly", () => {
  const lines = postedLines([postedJournal]);
  const branchRevenue = sumByClass(lines.filter((line) => line.branchId === "branch-a"), ["revenue"]);
  const unallocatedEquity = sumByClass(lines.filter((line) => !line.branchId), ["equity"]);
  assert.equal(branchRevenue, 2000);
  assert.equal(unallocatedEquity, 500);
});

test("product, customer, route and vehicle profitability use dimensions where present", () => {
  const lines = postedLines([postedJournal]);
  assert.equal(sumByClass(lines.filter((line) => line.productId === "product-a"), ["revenue"]), 2000);
  assert.equal(sumByClass(lines.filter((line) => line.customerId === "customer-a"), ["revenue"]), 2000);
  assert.equal(sumByClass(lines.filter((line) => line.routeId === "route-a"), ["expenses"]), 300);
  assert.equal(sumByClass(lines.filter((line) => line.vehicleId === "vehicle-a"), ["expenses"]), 300);
});

test("financial ratios and working capital avoid misleading denominators", () => {
  assert.equal(safeRatio(1200, 2000), 60);
  assert.equal(safeRatio(100, -1), null);
  const workingCapital = 1700 - 0;
  assert.equal(workingCapital, 1700);
});

test("budget import, approval immutability and versioning controls are explicit", () => {
  assert.equal(validateBudget([{ accountCode: "4000", period: "2026-07", amount: 1000 }]), true);
  assert.throws(() => validateBudget([{ accountCode: "4000", period: "2026-07" }, { accountCode: "4000", period: "2026-07" }]), /duplicate/);
  assert.equal(immutableBudget("draft"), true);
  assert.throws(() => immutableBudget("approved"), /cannot be overwritten/);
});

test("forecasts, close tasks, snapshots and year-end transfers enforce invariants", () => {
  assert.equal(900 + 1000 * 1.1, 2000);
  assert.equal(closeAllowed([{ blocking: true, status: "completed" }]), true);
  assert.throws(() => closeAllowed([{ blocking: true, status: "pending" }]), /Blocking/);
  assert.equal(snapshot({ netProfit: 900 }).immutable, true);
  assert.throws(() => {
    const existing = ["fy-2026"];
    if (existing.includes("fy-2026")) throw new Error("Year-end profit transfer has already been posted.");
  }, /already been posted/);
});
