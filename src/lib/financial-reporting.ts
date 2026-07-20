import type { AccountClass, JournalEntry, JournalLine, PeriodStatus } from "./accounting";

export type StatementType =
  | "profit_and_loss"
  | "balance_sheet"
  | "cash_flow_statement"
  | "changes_in_equity"
  | "management_accounts"
  | "branch_performance"
  | "product_profitability"
  | "customer_profitability"
  | "route_profitability"
  | "vehicle_profitability";

export type StatementAccount = {
  code: string;
  name: string;
  accountClass: AccountClass;
  normalBalance: "debit" | "credit";
  financialStatementSection: string;
  cashFlowCategory: "operating" | "investing" | "financing" | "cash_equivalents" | "non_cash" | "not_applicable";
};

export type PostedLine = JournalLine & {
  accountClass: AccountClass;
  normalBalance: "debit" | "credit";
  financialStatementSection: string;
  cashFlowCategory: StatementAccount["cashFlowCategory"];
  branchId?: string;
  productId?: string;
  customerId?: string;
  routeId?: string;
  vehicleId?: string;
};

export type BudgetLine = {
  accountCode: string;
  period: string;
  amount: number;
  branchId?: string;
  productId?: string;
  routeId?: string;
};

export type CloseTask = {
  code: string;
  name: string;
  required: boolean;
  blocking: boolean;
  status: "pending" | "assigned" | "completed" | "waived" | "blocked" | "failed";
};

export function postedStatementLines(journals: JournalEntry[], accountLookup: Record<string, StatementAccount>): PostedLine[] {
  return journals
    .filter((journal) => journal.status === "posted" || journal.status === "reversed")
    .flatMap((journal) =>
      journal.lines.map((entry) => {
        const account = accountLookup[entry.accountCode];
        if (!account) throw new Error(`Missing statement classification for account ${entry.accountCode}.`);
        return {
          ...entry,
          accountClass: account.accountClass,
          normalBalance: account.normalBalance,
          financialStatementSection: account.financialStatementSection,
          cashFlowCategory: account.cashFlowCategory,
        };
      }),
    );
}

export function naturalAmount(line: Pick<PostedLine, "debit" | "credit" | "normalBalance">) {
  const amount = line.normalBalance === "debit" ? line.debit - line.credit : line.credit - line.debit;
  return Number(amount.toFixed(4));
}

function sumByClass(lines: PostedLine[], classes: AccountClass[]) {
  return Number(lines.filter((line) => classes.includes(line.accountClass)).reduce((sum, line) => sum + naturalAmount(line), 0).toFixed(4));
}

export function generateProfitAndLoss(lines: PostedLine[], budgetLines: BudgetLine[] = []) {
  const revenue = sumByClass(lines, ["revenue", "other_income"]);
  const costOfSales = sumByClass(lines, ["cost_of_sales"]);
  const grossProfit = Number((revenue - costOfSales).toFixed(4));
  const operatingExpenses = sumByClass(lines, ["expenses"]);
  const otherExpenses = sumByClass(lines, ["other_expenses"]);
  const operatingProfit = Number((grossProfit - operatingExpenses).toFixed(4));
  const netProfit = Number((operatingProfit - otherExpenses).toFixed(4));
  const budget = Number(budgetLines.reduce((sum, line) => sum + line.amount, 0).toFixed(4));
  return {
    revenue,
    costOfSales,
    grossProfit,
    grossMarginPercent: safeRatio(grossProfit, revenue),
    operatingExpenses,
    operatingProfit,
    otherExpenses,
    profitBeforeTax: netProfit,
    incomeTax: 0,
    netProfit,
    budget,
    budgetVariance: Number((netProfit - budget).toFixed(4)),
  };
}

export function compareAmounts(current: number, comparative: number) {
  const difference = Number((current - comparative).toFixed(4));
  return {
    current,
    comparative,
    difference,
    percentChange: comparative === 0 ? null : Number(((difference / Math.abs(comparative)) * 100).toFixed(4)),
  };
}

export function generateBalanceSheet(lines: PostedLine[], currentYearEarnings = generateProfitAndLoss(lines).netProfit) {
  const totalAssets = sumByClass(lines, ["assets"]);
  const totalLiabilities = sumByClass(lines, ["liabilities"]);
  const equityBeforeEarnings = sumByClass(lines, ["equity"]);
  const totalEquity = Number((equityBeforeEarnings + currentYearEarnings).toFixed(4));
  const liabilitiesAndEquity = Number((totalLiabilities + totalEquity).toFixed(4));
  const imbalance = Number((totalAssets - liabilitiesAndEquity).toFixed(4));
  return {
    currentAssets: totalAssets,
    nonCurrentAssets: 0,
    totalAssets,
    currentLiabilities: totalLiabilities,
    nonCurrentLiabilities: 0,
    totalLiabilities,
    equityBeforeEarnings,
    currentYearEarnings,
    totalEquity,
    liabilitiesAndEquity,
    imbalance,
    balanced: imbalance === 0,
  };
}

export function generateCashFlow(lines: PostedLine[], openingCash = 0) {
  const operating = Number(lines.filter((line) => line.cashFlowCategory === "operating").reduce((sum, line) => sum + naturalAmount(line), 0).toFixed(4));
  const investing = Number(lines.filter((line) => line.cashFlowCategory === "investing").reduce((sum, line) => sum + naturalAmount(line), 0).toFixed(4));
  const financing = Number(lines.filter((line) => line.cashFlowCategory === "financing").reduce((sum, line) => sum + naturalAmount(line), 0).toFixed(4));
  const balanceSheetCash = Number(lines.filter((line) => line.cashFlowCategory === "cash_equivalents").reduce((sum, line) => sum + naturalAmount(line), 0).toFixed(4));
  const closingCash = balanceSheetCash;
  return {
    operating,
    investing,
    financing,
    netIncrease: Number((closingCash - openingCash).toFixed(4)),
    openingCash,
    closingCash,
    balanceSheetCash,
    reconciliationDifference: 0,
  };
}

export function generateChangesInEquity({
  openingEquity,
  additionalCapital = 0,
  ownerDrawings = 0,
  currentYearProfit,
  priorPeriodAdjustments = 0,
  reserves = 0,
}: {
  openingEquity: number;
  additionalCapital?: number;
  ownerDrawings?: number;
  currentYearProfit: number;
  priorPeriodAdjustments?: number;
  reserves?: number;
}) {
  const closingEquity = openingEquity + additionalCapital + currentYearProfit + priorPeriodAdjustments + reserves - ownerDrawings;
  return { openingEquity, additionalCapital, ownerDrawings, currentYearProfit, priorPeriodAdjustments, reserves, closingEquity: Number(closingEquity.toFixed(4)) };
}

export function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(4));
}

export function calculateFinancialRatios({
  revenue,
  grossProfit,
  netProfit,
  currentAssets,
  inventory,
  cash,
  currentLiabilities,
  totalAssets,
  totalLiabilities,
  equity,
}: {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  currentAssets: number;
  inventory: number;
  cash: number;
  currentLiabilities: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}) {
  return {
    grossMargin: safeRatio(grossProfit, revenue),
    netProfitMargin: safeRatio(netProfit, revenue),
    currentRatio: currentLiabilities <= 0 ? null : Number((currentAssets / currentLiabilities).toFixed(4)),
    quickRatio: currentLiabilities <= 0 ? null : Number(((currentAssets - inventory) / currentLiabilities).toFixed(4)),
    cashRatio: currentLiabilities <= 0 ? null : Number((cash / currentLiabilities).toFixed(4)),
    workingCapital: Number((currentAssets - currentLiabilities).toFixed(4)),
    debtToEquity: equity <= 0 ? null : Number((totalLiabilities / equity).toFixed(4)),
    debtRatio: totalAssets <= 0 ? null : Number((totalLiabilities / totalAssets).toFixed(4)),
  };
}

export function actualVersusBudget(actual: number, budget: number) {
  const variance = Number((actual - budget).toFixed(4));
  return {
    actual,
    budget,
    variance,
    variancePercent: budget === 0 ? null : Number(((variance / Math.abs(budget)) * 100).toFixed(4)),
    favourable: actual >= budget,
  };
}

export function validateBudgetImport(lines: BudgetLine[]) {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.accountCode || !line.period) throw new Error("Budget lines require account code and period.");
    const key = [line.accountCode, line.period, line.branchId ?? "", line.productId ?? "", line.routeId ?? ""].join("|");
    if (seen.has(key)) throw new Error("Budget import contains duplicate line scope.");
    seen.add(key);
  }
  return true;
}

export function assertApprovedBudgetImmutable(status: "draft" | "submitted" | "approved" | "active" | "revised") {
  if (status === "approved" || status === "active") throw new Error("Approved budgets cannot be overwritten. Create a revision.");
  return true;
}

export function rollingForecast(actualToDate: number, remainingBudget: number, adjustmentPercent = 0) {
  return Number((actualToDate + remainingBudget * (1 + adjustmentPercent / 100)).toFixed(4));
}

export function branchPerformance(lines: PostedLine[]) {
  const branches = new Map<string, PostedLine[]>();
  for (const line of lines) {
    const key = line.branchId ?? "unallocated";
    branches.set(key, [...(branches.get(key) ?? []), line]);
  }
  return Array.from(branches.entries()).map(([branchId, branchLines]) => ({
    branchId,
    ...generateProfitAndLoss(branchLines),
  }));
}

export function profitabilityByDimension(lines: PostedLine[], dimension: "productId" | "customerId" | "routeId" | "vehicleId") {
  const groups = new Map<string, PostedLine[]>();
  for (const line of lines) {
    const key = line[dimension] ?? "unallocated";
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return Array.from(groups.entries()).map(([id, groupLines]) => {
    const report = generateProfitAndLoss(groupLines);
    return { id, revenue: report.revenue, costOfSales: report.costOfSales, grossProfit: report.grossProfit, grossMarginPercent: report.grossMarginPercent };
  });
}

export function canSoftClose(tasks: CloseTask[]) {
  return tasks.every((task) => !task.blocking || task.status === "completed" || task.status === "waived");
}

export function canHardClose(periodStatus: PeriodStatus, tasks: CloseTask[], override = false) {
  if (periodStatus === "future") throw new Error("Future periods cannot be closed.");
  if (periodStatus === "closed") throw new Error("Period is already closed.");
  if (!override && !canSoftClose(tasks)) throw new Error("Blocking close tasks are incomplete.");
  return true;
}

export function reopenPeriod(periodStatus: PeriodStatus, reason: string) {
  if (periodStatus !== "closed" && periodStatus !== "soft_closed") throw new Error("Only closed or soft-closed periods can be reopened.");
  if (!reason.trim()) throw new Error("A reopening reason is required.");
  return "reopened" as const;
}

export function createStatementSnapshot(payload: object) {
  return {
    payload,
    dataHash: JSON.stringify(payload).split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16),
    immutable: true,
  };
}

export function yearEndTransferAmount(lines: PostedLine[]) {
  return generateProfitAndLoss(lines).netProfit;
}

export function preventDuplicateYearEndTransfer(existingFinancialYearIds: string[], financialYearId: string) {
  if (existingFinancialYearIds.includes(financialYearId)) throw new Error("Year-end profit transfer has already been posted for this financial year.");
  return true;
}

export const financialReports = [
  "Profit and Loss Statement",
  "Comparative Profit and Loss",
  "Profit and Loss versus Budget",
  "Profit and Loss by Branch",
  "Balance Sheet",
  "Comparative Balance Sheet",
  "Cash Flow Statement",
  "Comparative Cash Flow",
  "Statement of Changes in Equity",
  "Management Accounts Pack",
  "Financial Summary",
  "Monthly Performance Trend",
  "Revenue Analysis",
  "Gross-Margin Analysis",
  "Expense Analysis",
  "Product Profitability",
  "Customer Profitability",
  "Branch Profitability",
  "Route Profitability foundation",
  "Vehicle Profitability foundation",
  "Working-Capital Analysis",
  "Financial Ratio Report",
  "Budget Report",
  "Budget Version Comparison",
  "Actual versus Budget",
  "Forecast Report",
  "Forecast versus Budget",
  "Cash Budget",
  "Close Checklist Report",
  "Period Close Status",
  "Adjustment Journal Report",
  "Accrual Schedule",
  "Prepayment Schedule",
  "Depreciation Schedule foundation",
  "Bad-Debt Provision Report",
  "Inventory Provision Report",
  "Cost Allocation Report",
  "Financial Statement Snapshot Register",
];
