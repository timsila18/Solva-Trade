import { financialReports } from "./financial-reporting";

export const financialSummary = {
  revenueThisMonth: "KES 0.00",
  grossProfitThisMonth: "KES 0.00",
  netProfitThisMonth: "KES 0.00",
  grossMargin: "Not enough data",
  cashPosition: "KES 0.00",
  customerReceivables: "KES 0.00",
  overdueReceivables: "KES 0.00",
  supplierPayables: "KES 0.00",
  inventoryValue: "KES 0.00",
  workingCapital: "KES 0.00",
  budgetPerformance: "No active budget",
  forecastYearEndProfit: "No active forecast",
  currentRatio: "Not enough data",
  debtorDays: "Not enough data",
  inventoryDays: "Not enough data",
  creditorDays: "Not enough data",
  closeCycleStatus: "Not started",
  statementReadiness: "No posted statements",
};

export const financialWorkflows = [
  { title: "Profit and Loss", href: "/financials/profit-and-loss", description: "Generate current, comparative, branch and budget P&L statements from posted journal lines." },
  { title: "Balance Sheet", href: "/financials/balance-sheet", description: "Show assets, liabilities, equity and dynamic current-year earnings with imbalance diagnostics." },
  { title: "Cash Flow", href: "/financials/cash-flow", description: "Use cash-flow classifications for indirect-method operating, investing and financing sections." },
  { title: "Changes in Equity", href: "/financials/changes-in-equity", description: "Track owner capital, drawings, current-year profit, prior adjustments and retained earnings transfers." },
  { title: "Management Accounts", href: "/financials/management-accounts", description: "Prepare monthly, quarterly, annual or custom management packs with commentary and approvals." },
  { title: "Financial Ratios", href: "/financials/ratios", description: "Calculate profitability, liquidity, efficiency, leverage and growth ratios with zero-denominator safeguards." },
  { title: "Working Capital", href: "/financials/working-capital", description: "Review receivables, payables, inventory, cash, advances and cash conversion cycle foundations." },
  { title: "Branch Performance", href: "/financials/branch-performance", description: "Compare branch revenue, gross profit, expenses, cash, inventory and unallocated journal lines." },
  { title: "Product Profitability", href: "/financials/product-profitability", description: "Combine posted revenue and COGS lines with product dimensions for margin reporting." },
  { title: "Customer Profitability", href: "/financials/customer-profitability", description: "Review customer revenue, margin, discounts, returns and payment-delay foundations." },
  { title: "Route and Vehicle", href: "/financials/route-vehicle", description: "Track direct route and vehicle contribution without pretending placeholder allocations are final." },
  { title: "Budgets", href: "/financials/budgets", description: "Create versions, scenarios, approvals, active budgets and actual-versus-budget comparisons." },
  { title: "Forecasts", href: "/financials/forecasts", description: "Create short-term, profit, rolling and scenario forecasts with assumptions and superseding versions." },
  { title: "Period Close", href: "/financials/period-close", description: "Run close checklists, soft close, hard close, reopen and audit period-close decisions." },
  { title: "Adjustments", href: "/financials/adjustments", description: "Prepare accrual, prepayment, depreciation, bad-debt, inventory-provision and cost-allocation journals." },
  { title: "Snapshots", href: "/financials/snapshots", description: "Create immutable statement snapshots when packs are approved or periods are closed." },
  { title: "Reports", href: "/financials/reports", description: `${financialReports.length} financial reports are registered for PDF, CSV, workbook and print workflows.` },
];

export const statementLayouts = [
  "Profit and Loss",
  "Balance Sheet",
  "Cash Flow Statement",
  "Statement of Changes in Equity",
  "Management Income Statement",
  "Branch Performance Statement",
  "Product Profitability",
  "Route Profitability foundation",
  "Vehicle Profitability foundation",
];

export const closeTasks = [
  "Resolve failed accounting events",
  "Complete bank and M-Pesa reconciliations",
  "Reconcile customer control account",
  "Reconcile supplier control account",
  "Reconcile inventory to GL",
  "Confirm trial balance is balanced",
  "Review management accounts",
  "Create statement snapshots",
];

export const financialInsights = [
  "Financial insights stay empty until posted journals, budgets, forecasts and reconciliations provide real comparison data.",
  "Balance Sheet imbalance warnings come from posted journal lines and current-year earnings, not source invoices.",
  "Forecasts are shown as estimates and remain linked to their assumptions.",
];
