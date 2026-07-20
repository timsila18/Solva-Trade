import { accountingReports } from "./accounting";
import { distributionReports } from "./distribution";
import { financialReports } from "./financial-reporting";
import { inventoryReports } from "./inventory";
import { purchasingReports } from "./purchasing";
import { taxReports } from "./tax-compliance";
import { treasuryReports } from "./treasury";
import {
  executiveReports,
  generateMorningBrief,
  type AlertInput,
  type DashboardAudience,
  type DashboardFact,
  type TimelineEvent,
  widgetCatalog,
} from "./business-intelligence";

export const commandCentreFacts: DashboardFact[] = [
  { label: "Revenue today", value: "KES 0.00", source: "Posted sales invoices", permission: "sales.view" },
  { label: "Gross profit", value: "No posted journals", source: "Financial statement account activity", permission: "financial_reporting.view_statements" },
  { label: "Net profit", value: "No posted journals", source: "Profit and Loss engine", permission: "financial_reporting.view_statements" },
  { label: "Cash available", value: "KES 0.00", source: "Treasury account balances", permission: "finance.view_cashbook" },
  { label: "Bank", value: "KES 0.00", source: "Bank and cash ledger", permission: "finance.view_cashbook" },
  { label: "M-Pesa", value: "KES 0.00", source: "Mobile-money account ledger", permission: "finance.view_cashbook" },
  { label: "Working capital", value: "No posted balance sheet", source: "Financial reporting engine", permission: "financial_reporting.view_statements" },
  { label: "Receivables", value: "KES 0.00", source: "Customer transactions", permission: "sales.view_customer_balances" },
  { label: "Payables", value: "KES 0.00", source: "Supplier transactions", permission: "purchases.view_supplier_balances" },
  { label: "Inventory value", value: "KES 0.00", source: "Stock balance valuation", permission: "inventory.view_inventory_value" },
  { label: "Inventory at risk", value: "0", source: "Inventory alerts", permission: "inventory.view_stock" },
  { label: "Today's collections", value: "KES 0.00", source: "Treasury receipts and customer payments", permission: "finance.create_receipts" },
  { label: "Today's payments", value: "KES 0.00", source: "Treasury payments and supplier settlements", permission: "finance.create_payments" },
  { label: "Budget performance", value: "No active budget", source: "Approved budgets and posted journals", permission: "financial_reporting.view_statements" },
  { label: "Projected cash", value: "No forecast", source: "Forecast indicators", permission: "dashboard.view_business_insights", forecast: true },
  { label: "Projected revenue", value: "No forecast", source: "Forecast indicators", permission: "dashboard.view_business_insights", forecast: true },
  { label: "Tax status", value: "No open filing period", source: "Tax compliance calendar", permission: "tax.view_tax_reports" },
  { label: "Accounting status", value: "No open accounting period", source: "Accounting periods and diagnostics", permission: "accounting.view_general_ledger" },
  { label: "Business Health Score", value: "No score yet", source: "Business health snapshots", permission: "dashboard.view_business_health" },
];

export const morningBrief = generateMorningBrief(commandCentreFacts);

export const commandCentreSections = [
  "Business Snapshot",
  "Today's Priorities",
  "Morning Brief",
  "Business Health",
  "Cash Position",
  "Sales Today",
  "Collections Today",
  "Outstanding Customer Payments",
  "Supplier Payments Due",
  "Inventory Alerts",
  "Route Performance",
  "Vehicle Status",
  "Driver Cash Status",
  "Tax Compliance",
  "Accounting Status",
  "Budget Performance",
  "Today's Tasks",
  "Recent Activity",
  "Business Timeline",
  "Recommended Actions",
  "Upcoming Obligations",
  "Calendar",
  "Recent Notifications",
  "Pinned Reports",
  "Recent Documents",
  "Quick Actions",
];

export const healthCategories = [
  "Sales",
  "Profitability",
  "Cash",
  "Liquidity",
  "Inventory",
  "Debtors",
  "Creditors",
  "Tax Compliance",
  "Accounting",
  "Operational Efficiency",
  "Delivery Performance",
  "Stock Accuracy",
  "Budget Performance",
  "Customer Collections",
  "Supplier Performance",
  "Staff Productivity",
  "System Usage",
  "Data Quality",
  "Security",
].map((category) => ({
  category,
  score: null,
  trend: "no_data",
  explanation: `${category} score waits for posted source records and KPI snapshots.`,
  recommendation: "Complete the source workflow before relying on this component.",
}));

export const executiveDashboards: { audience: DashboardAudience; focus: string; widgets: string[] }[] = [
  { audience: "owner", focus: "Full business command, cash, profitability, risks, health, recommendations and executive pack.", widgets: ["business_health", "morning_brief", "cash_position", "sales_today", "recommendations", "business_timeline"] },
  { audience: "general_manager", focus: "Daily priorities, branch performance, operations, alerts, tasks and recommendations.", widgets: ["business_health", "route_performance", "inventory_alerts", "recommendations"] },
  { audience: "finance_manager", focus: "Cash, bank, M-Pesa, receivables, payables, reconciliations, tax and accounting status.", widgets: ["cash_position", "tax_compliance", "accounting_status", "budget_performance"] },
  { audience: "sales_manager", focus: "Sales today, collections, debtors, top customers, discounts, margin and follow-up tasks.", widgets: ["sales_today", "collections_today", "recommendations"] },
  { audience: "warehouse_manager", focus: "Inventory alerts, stock accuracy, stockouts, slow movers, transfers and expiry risks.", widgets: ["inventory_alerts", "data_quality", "recommendations"] },
  { audience: "operations_manager", focus: "Routes, vehicles, drivers, delivery exceptions, cash handovers and operational alerts.", widgets: ["route_performance", "business_timeline", "recommendations"] },
  { audience: "branch_manager", focus: "Branch-scoped sales, cash, inventory, deliveries, alerts and tasks.", widgets: ["business_health", "sales_today", "cash_position", "inventory_alerts"] },
  { audience: "storekeeper", focus: "Stock counts, low stock, transfers, batches, expiry and warehouse tasks.", widgets: ["inventory_alerts", "task_list"] },
  { audience: "driver", focus: "Assigned runs, delivery stops, collections, crates, expenses and cash handover.", widgets: ["route_performance", "task_list"] },
  { audience: "salesperson", focus: "Customers to follow up, quotations, invoices, collections and today sales.", widgets: ["sales_today", "collections_today", "task_list"] },
  { audience: "accountant", focus: "Journals, reconciliations, tax returns, financial close, reports and data quality.", widgets: ["accounting_status", "tax_compliance", "data_quality"] },
];

export const alertExamples: AlertInput[] = [
  { code: "low_stock", title: "Low stock", description: "Stock item has fallen below reorder level.", module: "Inventory", severity: "warning" },
  { code: "negative_stock", title: "Negative stock", description: "A stock balance is below zero and must be corrected.", module: "Inventory", severity: "critical" },
  { code: "large_expense", title: "Large expense", description: "Expense exceeds configured review threshold.", module: "Treasury", severity: "warning" },
  { code: "margin_below_threshold", title: "Margin below threshold", description: "Gross margin is below the configured target.", module: "Financials", severity: "warning" },
  { code: "customer_overdue", title: "Customer overdue", description: "Customer payment is beyond due date.", module: "Sales", severity: "warning" },
  { code: "tax_overdue", title: "Tax overdue", description: "Tax filing or payment is past due.", module: "Tax", severity: "critical" },
  { code: "failed_etims", title: "Failed eTIMS", description: "External tax document submission failed.", module: "Tax", severity: "critical" },
  { code: "security_event", title: "Security event", description: "Sensitive administrative action requires review.", module: "Administration", severity: "escalation" },
];

export const timelineFoundation: TimelineEvent[] = [
  { time: "No posted events yet", module: "Sales", title: "Invoice created", importance: "information", quickAction: "Open invoice" },
  { time: "No posted events yet", module: "Treasury", title: "Invoice paid", importance: "information", quickAction: "Open receipt" },
  { time: "No posted events yet", module: "Inventory", title: "Inventory adjustment", importance: "warning", quickAction: "Review adjustment" },
  { time: "No posted events yet", module: "Tax", title: "VAT return prepared", importance: "information", quickAction: "Open VAT return" },
  { time: "No posted events yet", module: "Distribution", title: "Route closed", importance: "information", quickAction: "Open route" },
  { time: "No posted events yet", module: "Accounting", title: "Journal posted", importance: "information", quickAction: "Open journal" },
];

export const dataQualityMetrics = [
  "Missing customer PINs",
  "Missing supplier PINs",
  "Products without categories",
  "Products without tax mapping",
  "Negative inventory",
  "Unmatched payments",
  "Failed journals",
  "Missing reconciliations",
  "Duplicate records",
  "Missing cost prices",
  "Missing selling prices",
  "Incomplete business setup",
];

export const systemHealthMetrics = [
  "Database health",
  "Queue health",
  "Background jobs",
  "Submission queues",
  "Failed integrations",
  "Storage usage",
  "Users online",
  "Recent backups foundation",
  "API response times",
  "Errors",
];

export const reportingHub = [
  ...executiveReports.map((name) => ({ name, category: "Executive" })),
  ...financialReports.map((name) => ({ name, category: "Financial" })),
  ...inventoryReports.map((name) => ({ name, category: "Inventory" })),
  ...purchasingReports.map((name) => ({ name, category: "Purchasing" })),
  ...distributionReports.map((name) => ({ name, category: "Distribution" })),
  ...treasuryReports.map((name) => ({ name, category: "Treasury" })),
  ...accountingReports.map((name) => ({ name, category: "Accounting" })),
  ...taxReports.map((name) => ({ name, category: "Tax" })),
];

export const pinnedReports = ["Executive Dashboard", "Business Health", "VAT Return Preparation", "Trial Balance"];

export const scheduledReportFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly"];

export const quickActions = [
  { label: "Record receipt", href: "/cash-bank/receipts" },
  { label: "Create invoice", href: "/sales/invoices" },
  { label: "Review low stock", href: "/inventory" },
  { label: "Prepare VAT return", href: "/tax/vat-return" },
  { label: "Post journal", href: "/accounting/manual-journals" },
  { label: "Open reports", href: "/reports" },
];

export { widgetCatalog };
