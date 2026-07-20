import { accountingReports, defaultKenyanSmeAccounts, defaultRoleMappings } from "./accounting";

export const accountingSummary = {
  currentPeriod: "No open period",
  postedToday: 0,
  awaitingApproval: 0,
  failedEvents: 0,
  awaitingMapping: 0,
  trialBalanceStatus: "No posted journals",
  customerControlDifference: "KES 0.00",
  supplierControlDifference: "KES 0.00",
  inventoryControlDifference: "KES 0.00",
  cashbookDifference: "KES 0.00",
  vatBalance: "KES 0.00",
  suspenseBalance: "KES 0.00",
};

export const setupWizardSteps = [
  "Accounting Basics",
  "Financial Year",
  "Chart of Accounts",
  "Account Role Mapping",
  "Tax Accounts",
  "Product and Inventory Accounts",
  "Customer and Supplier Control Accounts",
  "Cash, Bank and M-Pesa Accounts",
  "Opening Balances",
  "Review and Activate",
];

export const accountingWorkflows = [
  { title: "Setup wizard", href: "/accounting/setup", description: "Install the recommended chart, define financial years, map critical account roles and activate accounting only when ready." },
  { title: "Chart of accounts", href: "/accounting/chart-of-accounts", description: `${defaultKenyanSmeAccounts.length} recommended Kenyan SME accounts are available with account classes, normal balances and control-account flags.` },
  { title: "Account roles", href: "/accounting/account-roles", description: `${defaultRoleMappings.length} system roles map operational events to configurable accounts instead of fixed account codes.` },
  { title: "Account mappings", href: "/accounting/account-mappings", description: "Configure transaction, product, category, customer, supplier, branch, tax, payment-account and business-default mappings." },
  { title: "Financial years", href: "/accounting/financial-years", description: "Create non-calendar financial years, mark one current year and keep closed years immutable unless reopened." },
  { title: "Accounting periods", href: "/accounting/periods", description: "Open, soft close, close and reopen periods with sales, purchasing, inventory, cash and general-ledger locks." },
  { title: "Posting queue", href: "/accounting/posting-queue", description: "Inspect pending, failed, needs-review, posted, reversed and cancelled accounting events." },
  { title: "Manual journals", href: "/accounting/manual-journals", description: "Create balanced draft journals, submit them for approval, post approved entries and attach support." },
  { title: "Opening balances", href: "/accounting/opening-balances", description: "Import or enter opening balances through balanced opening journals and opening-balance equity." },
  { title: "Reversals", href: "/accounting/reversals", description: "Reverse posted journals through offsetting reversal journals without editing historical lines." },
  { title: "General ledger", href: "/accounting/general-ledger", description: "Filter account activity by period, branch, account, source module, customer, supplier, product, route, vehicle and status." },
  { title: "Trial balance", href: "/accounting/trial-balance", description: "View unadjusted, period, comparative, branch and consolidated trial-balance foundations with imbalance flags." },
  { title: "Journal register", href: "/accounting/journal-register", description: "Review sales, purchase, cash receipt, cash payment, bank, inventory, general, adjustment, reversal and opening journals." },
  { title: "Subledger reconciliation", href: "/accounting/reconciliation", description: "Compare customer, supplier, inventory, cashbook, VAT, owner, staff, driver-cash and packaging ledgers to GL control accounts." },
  { title: "Posting diagnostics", href: "/accounting/diagnostics", description: "Detect missing mappings, unbalanced attempts, duplicate postings, closed-period blocks, unreversed sources and control-account issues." },
  { title: "Imports", href: "/accounting/imports", description: "Import chart-of-accounts files and journal batches through template, mapping, validation, preview and commit steps." },
  { title: "Reports", href: "/accounting/reports", description: `${accountingReports.length} accounting reports are registered for PDF, CSV, Excel-compatible and print workflows.` },
];

export const accountingInsights = [
  "Accounting insights stay empty until real accounting events, journals and subledger balances exist.",
  "The trial balance is reported only from posted journal lines.",
  "Customer, supplier, inventory and cashbook control checks compare operational ledgers to posted general-ledger balances.",
];

export const diagnosticTypes = [
  "Unbalanced journal attempt",
  "Missing account role",
  "Missing product mapping",
  "Missing tax mapping",
  "Missing financial-account mapping",
  "Event posted twice",
  "Operational transaction posted without journal",
  "Manual journal to control account",
  "Subledger and control-account mismatch",
  "Invalid or closed period",
  "Backdated posting",
  "Reversed source with unreversed journal",
  "Suspense-account balance",
  "Draft journal older than threshold",
  "Failed accounting event",
];

export const journalTypes = [
  "Sales Journal",
  "Purchase Journal",
  "Cash Receipt Journal",
  "Cash Payment Journal",
  "Bank Journal",
  "Inventory Journal",
  "Tax Journal",
  "General Journal",
  "Opening Journal",
  "Adjustment Journal",
  "Reversal Journal",
  "Transfer Journal",
  "Owner Transaction Journal",
];
