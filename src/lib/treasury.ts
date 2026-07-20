export type MoneyDirection = "in" | "out" | "neutral";
export type MatchKind = "one_to_one" | "one_to_many" | "many_to_one" | "partial" | "unmatched";

export function maskAccountNumber(value: string, canViewFullDetails = false) {
  const normalized = value.replace(/\s+/g, "");
  if (canViewFullDetails || normalized.length <= 4) return normalized;
  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function applyFinancialTransaction(balance: number, direction: MoneyDirection, amount: number, allowNegative = false) {
  if (amount < 0) throw new Error("Amount cannot be negative.");
  const next = direction === "in" ? balance + amount : direction === "out" ? balance - amount : balance;
  if (!allowNegative && next < 0) throw new Error("This transaction would create a negative account balance.");
  return next;
}

export function validateAccountTransfer({
  fromAccountId,
  toAccountId,
  fromCurrency,
  toCurrency,
  exchangeRate,
}: {
  fromAccountId: string;
  toAccountId: string;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate?: number;
}) {
  if (fromAccountId === toAccountId) throw new Error("Cannot transfer money to the same account.");
  if (fromCurrency !== toCurrency && (!exchangeRate || exchangeRate <= 0)) {
    throw new Error("Cross-currency transfers require an exchange rate.");
  }
  return true;
}

export function calculateTransferReceipt({ amountSent, fees = 0, amountReceived }: { amountSent: number; fees?: number; amountReceived?: number }) {
  if (amountSent < 0 || fees < 0) throw new Error("Transfer amounts cannot be negative.");
  const expected = amountSent - fees;
  const received = amountReceived ?? expected;
  return {
    expectedReceived: expected,
    variance: received - expected,
  };
}

export function calculateCashCountVariance(expectedBalance: number, denominationBreakdown: Record<string, number>) {
  const countedBalance = Object.entries(denominationBreakdown).reduce((sum, [denomination, count]) => {
    const value = Number(denomination);
    if (!Number.isFinite(value) || count < 0) throw new Error("Invalid denomination breakdown.");
    return sum + value * count;
  }, 0);
  return { countedBalance, variance: countedBalance - expectedBalance };
}

export function reconcileStatementLine({
  statementAmount,
  transactionAmounts,
}: {
  statementAmount: number;
  transactionAmounts: number[];
}): { kind: MatchKind; difference: number } {
  const total = transactionAmounts.reduce((sum, amount) => sum + amount, 0);
  const difference = Number((statementAmount - total).toFixed(2));
  if (transactionAmounts.length === 0) return { kind: "unmatched", difference: statementAmount };
  if (difference === 0 && transactionAmounts.length === 1) return { kind: "one_to_one", difference };
  if (difference === 0 && transactionAmounts.length > 1) return { kind: "one_to_many", difference };
  return { kind: "partial", difference };
}

export function detectDuplicateReference(existingReferences: string[], reference?: string | null) {
  if (!reference) return false;
  return existingReferences.map((item) => item.trim().toUpperCase()).includes(reference.trim().toUpperCase());
}

export function calculatePettyCashReconciliation({
  openingFloat,
  cashReceived,
  vouchersPaid,
  cashReturned,
  countedCash,
}: {
  openingFloat: number;
  cashReceived: number;
  vouchersPaid: number;
  cashReturned: number;
  countedCash: number;
}) {
  const expectedCash = openingFloat + cashReceived - vouchersPaid - cashReturned;
  return { expectedCash, variance: countedCash - expectedCash };
}

export function ownerLedgerBalance(entries: { direction: MoneyDirection; amount: number }[]) {
  return entries.reduce((balance, entry) => applyFinancialTransaction(balance, entry.direction, entry.amount, true), 0);
}

export function staffAdvanceOutstanding({ issued, surrendered, refunded }: { issued: number; surrendered: number; refunded: number }) {
  const outstanding = issued - surrendered - refunded;
  return Math.max(0, Number(outstanding.toFixed(2)));
}

export function cashflowForecast({
  openingCash,
  inflows,
  outflows,
}: {
  openingCash: number;
  inflows: number[];
  outflows: number[];
}) {
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

export const treasuryReports = [
  "Financial Account List",
  "Cashbook",
  "Cash Receipts Report",
  "Cash Payments Report",
  "General Receipts Report",
  "General Payments Report",
  "Expense Report",
  "Expense by Category",
  "Expense by Branch",
  "Expense by Vehicle",
  "Expense by Route",
  "Expense Claim Report",
  "Petty-Cash Report",
  "Petty-Cash Reconciliation",
  "Bank Deposit Report",
  "Withdrawal Report",
  "Account Transfer Report",
  "Bank Charge Report",
  "Mobile-Money Charge Report",
  "Interest Report",
  "Owner Transaction Report",
  "Owner Current-Account Statement",
  "Owner Drawings Report",
  "Owner Loan Report",
  "Staff Advance Report",
  "Advance Surrender Report",
  "Driver Cash Custody Report",
  "Route Cash Handover Report",
  "Cash in Transit Report",
  "Bank Statement Import Report",
  "M-Pesa Statement Import Report",
  "Bank Reconciliation Report",
  "Mobile-Money Reconciliation Report",
  "Unreconciled Transactions",
  "Unidentified Receipts",
  "Duplicate Transaction Report",
  "Cheque Register",
  "Bounced Cheque Report",
  "Deposits in Transit",
  "Pending Settlements",
  "Cash Count Report",
  "Cash Variance Report",
  "Daily Cash-Up Report",
  "Account Balance Report",
  "Treasury Position Report",
  "Short-Term Cashflow Forecast",
  "Closed and Reopened Reconciliations",
];
