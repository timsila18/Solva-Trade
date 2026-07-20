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

function maskAccountNumber(value, canViewFullDetails = false) {
  const normalized = value.replace(/\s+/g, "");
  if (canViewFullDetails || normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

function applyFinancialTransaction(balance, direction, amount, allowNegative = false) {
  if (amount < 0) throw new Error("Amount cannot be negative.");
  const next = direction === "in" ? balance + amount : direction === "out" ? balance - amount : balance;
  if (!allowNegative && next < 0) throw new Error("This transaction would create a negative account balance.");
  return next;
}

function validateAccountTransfer({ fromAccountId, toAccountId, fromCurrency, toCurrency, exchangeRate }) {
  if (fromAccountId === toAccountId) throw new Error("Cannot transfer money to the same account.");
  if (fromCurrency !== toCurrency && (!exchangeRate || exchangeRate <= 0)) throw new Error("Cross-currency transfers require an exchange rate.");
  return true;
}

function calculateTransferReceipt({ amountSent, fees = 0, amountReceived }) {
  if (amountSent < 0 || fees < 0) throw new Error("Transfer amounts cannot be negative.");
  const expected = amountSent - fees;
  const received = amountReceived ?? expected;
  return { expectedReceived: expected, variance: received - expected };
}

function calculateCashCountVariance(expectedBalance, denominationBreakdown) {
  const countedBalance = Object.entries(denominationBreakdown).reduce((sum, [denomination, count]) => {
    const value = Number(denomination);
    if (!Number.isFinite(value) || count < 0) throw new Error("Invalid denomination breakdown.");
    return sum + value * count;
  }, 0);
  return { countedBalance, variance: countedBalance - expectedBalance };
}

function reconcileStatementLine({ statementAmount, transactionAmounts }) {
  const total = transactionAmounts.reduce((sum, amount) => sum + amount, 0);
  const difference = Number((statementAmount - total).toFixed(2));
  if (transactionAmounts.length === 0) return { kind: "unmatched", difference: statementAmount };
  if (difference === 0 && transactionAmounts.length === 1) return { kind: "one_to_one", difference };
  if (difference === 0 && transactionAmounts.length > 1) return { kind: "one_to_many", difference };
  return { kind: "partial", difference };
}

function detectDuplicateReference(existingReferences, reference) {
  if (!reference) return false;
  return existingReferences.map((item) => item.trim().toUpperCase()).includes(reference.trim().toUpperCase());
}

function calculatePettyCashReconciliation({ openingFloat, cashReceived, vouchersPaid, cashReturned, countedCash }) {
  const expectedCash = openingFloat + cashReceived - vouchersPaid - cashReturned;
  return { expectedCash, variance: countedCash - expectedCash };
}

function ownerLedgerBalance(entries) {
  return entries.reduce((balance, entry) => applyFinancialTransaction(balance, entry.direction, entry.amount, true), 0);
}

function staffAdvanceOutstanding({ issued, surrendered, refunded }) {
  return Math.max(0, Number((issued - surrendered - refunded).toFixed(2)));
}

function cashflowForecast({ openingCash, inflows, outflows }) {
  const expectedInflows = inflows.reduce((sum, value) => sum + value, 0);
  const expectedOutflows = outflows.reduce((sum, value) => sum + value, 0);
  const forecastClosingCash = openingCash + expectedInflows - expectedOutflows;
  return {
    expectedInflows,
    expectedOutflows,
    forecastClosingCash,
    fundingGap: forecastClosingCash < 0 ? Math.abs(forecastClosingCash) : 0,
    surplus: forecastClosingCash > 0 ? forecastClosingCash : 0,
  };
}

test("sensitive account details are masked unless permitted", () => {
  assert.equal(maskAccountNumber("1234567890"), "******7890");
  assert.equal(maskAccountNumber("1234567890", true), "1234567890");
});

test("financial ledger balance blocks unauthorised negative balances", () => {
  assert.equal(applyFinancialTransaction(1000, "in", 250), 1250);
  assert.equal(applyFinancialTransaction(1000, "out", 250), 750);
  assert.throws(() => applyFinancialTransaction(100, "out", 200), /negative/);
  assert.equal(applyFinancialTransaction(100, "out", 200, true), -100);
});

test("account transfers block same-account and unmanaged cross-currency moves", () => {
  assert.equal(validateAccountTransfer({ fromAccountId: "a", toAccountId: "b", fromCurrency: "KES", toCurrency: "KES" }), true);
  assert.throws(() => validateAccountTransfer({ fromAccountId: "a", toAccountId: "a", fromCurrency: "KES", toCurrency: "KES" }), /same account/);
  assert.throws(() => validateAccountTransfer({ fromAccountId: "a", toAccountId: "b", fromCurrency: "KES", toCurrency: "USD" }), /exchange rate/);
});

test("transfer fees and partial receipt variances are explicit", () => {
  assert.deepEqual(calculateTransferReceipt({ amountSent: 1000, fees: 50 }), { expectedReceived: 950, variance: 0 });
  assert.deepEqual(calculateTransferReceipt({ amountSent: 1000, fees: 50, amountReceived: 900 }), { expectedReceived: 950, variance: -50 });
});

test("cash counts calculate denomination totals and variance", () => {
  assert.deepEqual(calculateCashCountVariance(1500, { 1000: 1, 500: 1, 100: 2 }), { countedBalance: 1700, variance: 200 });
  assert.throws(() => calculateCashCountVariance(100, { note: 1 }), /Invalid denomination/);
});

test("statement matching supports unmatched, one-to-one, one-to-many and partial", () => {
  assert.deepEqual(reconcileStatementLine({ statementAmount: 1000, transactionAmounts: [] }), { kind: "unmatched", difference: 1000 });
  assert.deepEqual(reconcileStatementLine({ statementAmount: 1000, transactionAmounts: [1000] }), { kind: "one_to_one", difference: 0 });
  assert.deepEqual(reconcileStatementLine({ statementAmount: 1000, transactionAmounts: [600, 400] }), { kind: "one_to_many", difference: 0 });
  assert.deepEqual(reconcileStatementLine({ statementAmount: 1000, transactionAmounts: [800] }), { kind: "partial", difference: 200 });
});

test("duplicate M-Pesa or bank references are detected case-insensitively", () => {
  assert.equal(detectDuplicateReference(["QHA123", "BANK-9"], " qha123 "), true);
  assert.equal(detectDuplicateReference(["QHA123"], "QHA124"), false);
});

test("petty cash reconciliation isolates variance", () => {
  assert.deepEqual(calculatePettyCashReconciliation({ openingFloat: 5000, cashReceived: 1000, vouchersPaid: 2800, cashReturned: 200, countedCash: 3000 }), { expectedCash: 3000, variance: 0 });
});

test("owner current account ledger separates money in and drawings", () => {
  assert.equal(ownerLedgerBalance([{ direction: "in", amount: 10000 }, { direction: "out", amount: 2500 }]), 7500);
});

test("staff advance outstanding cannot go below zero", () => {
  assert.equal(staffAdvanceOutstanding({ issued: 10000, surrendered: 6000, refunded: 1000 }), 3000);
  assert.equal(staffAdvanceOutstanding({ issued: 10000, surrendered: 11000, refunded: 0 }), 0);
});

test("cashflow forecast exposes funding gap or surplus", () => {
  assert.deepEqual(cashflowForecast({ openingCash: 1000, inflows: [500], outflows: [2000] }), {
    expectedInflows: 500,
    expectedOutflows: 2000,
    forecastClosingCash: -500,
    fundingGap: 500,
    surplus: 0,
  });
});
