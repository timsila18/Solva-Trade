export type AccountClass =
  | "assets"
  | "liabilities"
  | "equity"
  | "revenue"
  | "cost_of_sales"
  | "expenses"
  | "other_income"
  | "other_expenses";

export type NormalBalance = "debit" | "credit";
export type JournalStatus = "draft" | "pending_approval" | "approved" | "posted" | "reversed" | "cancelled" | "failed";
export type PeriodStatus = "future" | "open" | "soft_closed" | "closed" | "reopened";

export type ChartAccount = {
  id: string;
  code: string;
  name: string;
  accountClass: AccountClass;
  normalBalance: NormalBalance;
  parentCode?: string;
  isPosting: boolean;
  isHeader: boolean;
  isControl: boolean;
  systemRole?: AccountRoleCode;
};

export type AccountRoleCode =
  | "CUSTOMER_RECEIVABLES"
  | "SUPPLIER_PAYABLES"
  | "SALES_REVENUE"
  | "SERVICE_REVENUE"
  | "INVENTORY_ASSET"
  | "VEHICLE_STOCK"
  | "INVENTORY_IN_TRANSIT"
  | "GOODS_RECEIVED_NOT_INVOICED"
  | "COST_OF_GOODS_SOLD"
  | "PURCHASE_PRICE_VARIANCE"
  | "SALES_DISCOUNT"
  | "SALES_RETURNS"
  | "OUTPUT_VAT"
  | "INPUT_VAT"
  | "VAT_PAYABLE"
  | "WITHHOLDING_TAX_PAYABLE"
  | "CASH_ON_HAND"
  | "CASH_IN_TRANSIT"
  | "BANK_ACCOUNT"
  | "MOBILE_MONEY_ACCOUNT"
  | "CUSTOMER_DEPOSITS"
  | "SUPPLIER_ADVANCES"
  | "STAFF_ADVANCES"
  | "OWNER_CAPITAL"
  | "OWNER_DRAWINGS"
  | "OWNER_LOAN"
  | "OWNER_CURRENT_ACCOUNT"
  | "CASH_SHORTAGE"
  | "CASH_SURPLUS"
  | "BANK_CHARGES"
  | "MOBILE_MONEY_CHARGES"
  | "ROUTE_EXPENSE"
  | "PACKAGING_ASSET"
  | "PACKAGING_DEPOSIT_LIABILITY"
  | "OPENING_BALANCE_EQUITY"
  | "RETAINED_EARNINGS"
  | "CURRENT_YEAR_EARNINGS";

export type JournalLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  customerId?: string;
  supplierId?: string;
  productId?: string;
  description: string;
};

export type JournalEntry = {
  journalNumber: string;
  type: string;
  status: JournalStatus;
  sourceModule?: string;
  sourceTransactionId?: string;
  lines: JournalLine[];
};

export type AccountingEvent = {
  idempotencyKey: string;
  eventType: string;
  amount: number;
  taxAmount?: number;
  costAmount?: number;
  customerId?: string;
  supplierId?: string;
  productId?: string;
  financeAccountId?: string;
};

export type AccountMapping = {
  role: AccountRoleCode;
  accountCode: string;
  priority: number;
  scope: "transaction" | "product" | "category" | "customer" | "supplier" | "branch" | "tax" | "payment_account" | "business";
  scopeId?: string;
};

export const defaultKenyanSmeAccounts: ChartAccount[] = [
  { id: "1000", code: "1000", name: "Cash on Hand", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "CASH_ON_HAND" },
  { id: "1020", code: "1020", name: "Cash in Transit", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "CASH_IN_TRANSIT" },
  { id: "1100", code: "1100", name: "Bank Accounts", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "BANK_ACCOUNT" },
  { id: "1110", code: "1110", name: "M-Pesa and Mobile Money", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "MOBILE_MONEY_ACCOUNT" },
  { id: "1200", code: "1200", name: "Customer Receivables", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "CUSTOMER_RECEIVABLES" },
  { id: "1300", code: "1300", name: "Supplier Advances", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "SUPPLIER_ADVANCES" },
  { id: "1310", code: "1310", name: "Staff Advances", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "STAFF_ADVANCES" },
  { id: "1400", code: "1400", name: "Inventory", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "INVENTORY_ASSET" },
  { id: "1410", code: "1410", name: "Inventory in Transit", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "INVENTORY_IN_TRANSIT" },
  { id: "1420", code: "1420", name: "Vehicle Stock", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "VEHICLE_STOCK" },
  { id: "1450", code: "1450", name: "Returnable Packaging", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "PACKAGING_ASSET" },
  { id: "1500", code: "1500", name: "Input VAT", accountClass: "assets", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "INPUT_VAT" },
  { id: "2000", code: "2000", name: "Supplier Payables", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "SUPPLIER_PAYABLES" },
  { id: "2010", code: "2010", name: "Goods Received Not Invoiced", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "GOODS_RECEIVED_NOT_INVOICED" },
  { id: "2100", code: "2100", name: "Customer Deposits", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "CUSTOMER_DEPOSITS" },
  { id: "2120", code: "2120", name: "Packaging Deposits", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "PACKAGING_DEPOSIT_LIABILITY" },
  { id: "2200", code: "2200", name: "Output VAT", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "OUTPUT_VAT" },
  { id: "2210", code: "2210", name: "VAT Payable", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "VAT_PAYABLE" },
  { id: "2220", code: "2220", name: "Withholding Tax Payable", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "WITHHOLDING_TAX_PAYABLE" },
  { id: "2410", code: "2410", name: "Owner Loan Payable", accountClass: "liabilities", normalBalance: "credit", isPosting: true, isHeader: false, isControl: true, systemRole: "OWNER_LOAN" },
  { id: "3000", code: "3000", name: "Owner Capital", accountClass: "equity", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "OWNER_CAPITAL" },
  { id: "3100", code: "3100", name: "Retained Earnings", accountClass: "equity", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "RETAINED_EARNINGS" },
  { id: "3110", code: "3110", name: "Current-Year Earnings", accountClass: "equity", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "CURRENT_YEAR_EARNINGS" },
  { id: "3200", code: "3200", name: "Owner Drawings", accountClass: "equity", normalBalance: "debit", isPosting: true, isHeader: false, isControl: true, systemRole: "OWNER_DRAWINGS" },
  { id: "3300", code: "3300", name: "Opening Balance Equity", accountClass: "equity", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "OPENING_BALANCE_EQUITY" },
  { id: "4000", code: "4000", name: "Product Sales", accountClass: "revenue", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "SALES_REVENUE" },
  { id: "4010", code: "4010", name: "Service Revenue", accountClass: "revenue", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "SERVICE_REVENUE" },
  { id: "4100", code: "4100", name: "Discounts Allowed", accountClass: "revenue", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "SALES_DISCOUNT" },
  { id: "4110", code: "4110", name: "Sales Returns", accountClass: "revenue", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "SALES_RETURNS" },
  { id: "5000", code: "5000", name: "Cost of Goods Sold", accountClass: "cost_of_sales", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "COST_OF_GOODS_SOLD" },
  { id: "5010", code: "5010", name: "Purchase Price Variance", accountClass: "cost_of_sales", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "PURCHASE_PRICE_VARIANCE" },
  { id: "6050", code: "6050", name: "Delivery Expenses", accountClass: "expenses", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "ROUTE_EXPENSE" },
  { id: "6060", code: "6060", name: "Bank Charges", accountClass: "expenses", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "BANK_CHARGES" },
  { id: "6070", code: "6070", name: "M-Pesa Charges", accountClass: "expenses", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "MOBILE_MONEY_CHARGES" },
  { id: "6210", code: "6210", name: "Cash Shortage", accountClass: "expenses", normalBalance: "debit", isPosting: true, isHeader: false, isControl: false, systemRole: "CASH_SHORTAGE" },
  { id: "7900", code: "7900", name: "Cash Surplus", accountClass: "other_income", normalBalance: "credit", isPosting: true, isHeader: false, isControl: false, systemRole: "CASH_SURPLUS" },
];

export const defaultRoleMappings: AccountMapping[] = defaultKenyanSmeAccounts
  .filter((account): account is ChartAccount & { systemRole: AccountRoleCode } => Boolean(account.systemRole))
  .map((account) => ({ role: account.systemRole, accountCode: account.code, priority: 100, scope: "business" }));

export function assertUniqueAccountCodes(accounts: ChartAccount[]) {
  const seen = new Set<string>();
  for (const account of accounts) {
    const key = account.code.trim().toUpperCase();
    if (seen.has(key)) throw new Error(`Duplicate account code: ${account.code}`);
    seen.add(key);
  }
  return true;
}

export function detectCircularAccount(accounts: Pick<ChartAccount, "code" | "parentCode">[]) {
  const byCode = new Map(accounts.map((account) => [account.code, account.parentCode]));
  for (const account of accounts) {
    const visited = new Set<string>();
    let parent = account.parentCode;
    while (parent) {
      if (parent === account.code || visited.has(parent)) return true;
      visited.add(parent);
      parent = byCode.get(parent);
    }
  }
  return false;
}

export function canPostToAccount(account: Pick<ChartAccount, "isHeader" | "isPosting">) {
  if (account.isHeader || !account.isPosting) throw new Error("Journal lines can only use posting accounts.");
  return true;
}

export function resolveAccountMapping({
  mappings,
  role,
  scopeHints = {},
}: {
  mappings: AccountMapping[];
  role: AccountRoleCode;
  scopeHints?: Partial<Record<AccountMapping["scope"], string>>;
}) {
  const rankedScopes: AccountMapping["scope"][] = ["transaction", "product", "category", "customer", "supplier", "branch", "tax", "payment_account", "business"];
  const candidates = mappings
    .filter((mapping) => mapping.role === role)
    .filter((mapping) => mapping.scope === "business" || scopeHints[mapping.scope] === mapping.scopeId)
    .sort((a, b) => rankedScopes.indexOf(a.scope) - rankedScopes.indexOf(b.scope) || a.priority - b.priority);
  const match = candidates[0];
  if (!match) throw new Error(`Missing account mapping for ${role}.`);
  return match.accountCode;
}

export function assertBalancedJournal(lines: Pick<JournalLine, "debit" | "credit">[]) {
  const debit = Number(lines.reduce((sum, line) => sum + line.debit, 0).toFixed(4));
  const credit = Number(lines.reduce((sum, line) => sum + line.credit, 0).toFixed(4));
  if (debit <= 0 || credit <= 0 || debit !== credit) {
    throw new Error(`Journal is not balanced. Debit ${debit}, credit ${credit}.`);
  }
  return { debit, credit };
}

function accountName(accounts: ChartAccount[], code: string) {
  return accounts.find((account) => account.code === code)?.name ?? code;
}

function line(accounts: ChartAccount[], accountCode: string, debit: number, credit: number, description: string, detail: Partial<JournalLine> = {}): JournalLine {
  const account = accounts.find((item) => item.code === accountCode);
  if (!account) throw new Error(`Missing account ${accountCode}.`);
  canPostToAccount(account);
  return { accountCode, accountName: accountName(accounts, accountCode), debit, credit, description, ...detail };
}

export function buildJournalFromEvent({
  event,
  accounts = defaultKenyanSmeAccounts,
  mappings = defaultRoleMappings,
  journalNumber = "GJ-DRAFT",
}: {
  event: AccountingEvent;
  accounts?: ChartAccount[];
  mappings?: AccountMapping[];
  journalNumber?: string;
}): JournalEntry {
  const tax = event.taxAmount ?? 0;
  const cost = event.costAmount ?? 0;
  const net = event.amount - tax;
  const resolve = (role: AccountRoleCode) => resolveAccountMapping({ mappings, role, scopeHints: { product: event.productId, customer: event.customerId, supplier: event.supplierId, payment_account: event.financeAccountId } });
  const lines: JournalLine[] = [];

  if (event.eventType === "credit_sale") {
    lines.push(line(accounts, resolve("CUSTOMER_RECEIVABLES"), event.amount, 0, "Money customers owe", { customerId: event.customerId }));
    lines.push(line(accounts, resolve("SALES_REVENUE"), 0, net, "Product sales", { productId: event.productId }));
    if (tax > 0) lines.push(line(accounts, resolve("OUTPUT_VAT"), 0, tax, "Output VAT"));
    if (cost > 0) {
      lines.push(line(accounts, resolve("COST_OF_GOODS_SOLD"), cost, 0, "Cost of goods sold", { productId: event.productId }));
      lines.push(line(accounts, resolve("INVENTORY_ASSET"), 0, cost, "Inventory issued", { productId: event.productId }));
    }
  } else if (event.eventType === "customer_payment") {
    lines.push(line(accounts, resolve("BANK_ACCOUNT"), event.amount, 0, "Cash or bank received"));
    lines.push(line(accounts, resolve("CUSTOMER_RECEIVABLES"), 0, event.amount, "Customer receivable cleared", { customerId: event.customerId }));
  } else if (event.eventType === "supplier_bill_inventory") {
    lines.push(line(accounts, resolve("GOODS_RECEIVED_NOT_INVOICED"), net, 0, "Clear GRNI", { supplierId: event.supplierId, productId: event.productId }));
    if (tax > 0) lines.push(line(accounts, resolve("INPUT_VAT"), tax, 0, "Input VAT"));
    lines.push(line(accounts, resolve("SUPPLIER_PAYABLES"), 0, event.amount, "Supplier payable", { supplierId: event.supplierId }));
  } else if (event.eventType === "supplier_payment") {
    lines.push(line(accounts, resolve("SUPPLIER_PAYABLES"), event.amount, 0, "Supplier payable settled", { supplierId: event.supplierId }));
    lines.push(line(accounts, resolve("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  } else if (event.eventType === "owner_capital") {
    lines.push(line(accounts, resolve("BANK_ACCOUNT"), event.amount, 0, "Cash or bank received"));
    lines.push(line(accounts, resolve("OWNER_CAPITAL"), 0, event.amount, "Owner capital"));
  } else if (event.eventType === "owner_drawing") {
    lines.push(line(accounts, resolve("OWNER_DRAWINGS"), event.amount, 0, "Owner drawing"));
    lines.push(line(accounts, resolve("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  } else if (event.eventType === "staff_advance") {
    lines.push(line(accounts, resolve("STAFF_ADVANCES"), event.amount, 0, "Staff advance"));
    lines.push(line(accounts, resolve("BANK_ACCOUNT"), 0, event.amount, "Cash or bank paid"));
  } else {
    throw new Error(`No posting rule is configured for ${event.eventType}.`);
  }

  assertBalancedJournal(lines);
  return { journalNumber, type: event.eventType, status: "draft", lines };
}

export function reverseJournal(journal: JournalEntry, reversalNumber: string, reason: string): JournalEntry {
  if (journal.status !== "posted") throw new Error("Only posted journals can be reversed.");
  if (!reason.trim()) throw new Error("A reversal reason is required.");
  return {
    journalNumber: reversalNumber,
    type: "reversal_journal",
    status: "posted",
    sourceModule: journal.sourceModule,
    sourceTransactionId: journal.sourceTransactionId,
    lines: journal.lines.map((entry) => ({
      ...entry,
      debit: entry.credit,
      credit: entry.debit,
      description: `Reversal: ${entry.description}`,
    })),
  };
}

export function calculateTrialBalance(journals: JournalEntry[]) {
  const posted = journals.filter((journal) => journal.status === "posted" || journal.status === "reversed");
  const rows = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();
  for (const journal of posted) {
    for (const entry of journal.lines) {
      const row = rows.get(entry.accountCode) ?? { accountCode: entry.accountCode, accountName: entry.accountName, debit: 0, credit: 0 };
      row.debit += entry.debit;
      row.credit += entry.credit;
      rows.set(entry.accountCode, row);
    }
  }
  const values = Array.from(rows.values()).map((row) => ({
    ...row,
    debit: Number(row.debit.toFixed(4)),
    credit: Number(row.credit.toFixed(4)),
    closingDebit: Number(Math.max(row.debit - row.credit, 0).toFixed(4)),
    closingCredit: Number(Math.max(row.credit - row.debit, 0).toFixed(4)),
  }));
  const totals = values.reduce(
    (sum, row) => ({ debit: Number((sum.debit + row.debit).toFixed(4)), credit: Number((sum.credit + row.credit).toFixed(4)) }),
    { debit: 0, credit: 0 },
  );
  return { rows: values, totals, balanced: totals.debit === totals.credit };
}

export function reconcileControlAccount(glBalance: number, subledgerBalance: number) {
  const difference = Number((glBalance - subledgerBalance).toFixed(4));
  return {
    difference,
    status: difference === 0 ? "reconciled" : Math.abs(difference) <= 10 ? "small_difference" : "difference_found",
  };
}

export function canPostToPeriod(status: PeriodStatus, moduleLocked = false) {
  if (status === "closed" || moduleLocked) throw new Error("Cannot post into a closed or locked accounting period.");
  return status === "open" || status === "soft_closed" || status === "reopened";
}

export function validateChartImport(rows: { code: string; name: string; parentCode?: string; isPosting?: boolean; isHeader?: boolean }[]) {
  assertUniqueAccountCodes(
    rows.map((row) => ({
      id: row.code,
      code: row.code,
      name: row.name,
      accountClass: "assets",
      normalBalance: "debit",
      parentCode: row.parentCode,
      isPosting: row.isPosting ?? true,
      isHeader: row.isHeader ?? false,
      isControl: false,
    })),
  );
  if (detectCircularAccount(rows.map((row) => ({ code: row.code, parentCode: row.parentCode })))) {
    throw new Error("Chart import contains a circular parent relationship.");
  }
  const codes = new Set(rows.map((row) => row.code));
  const missingParent = rows.find((row) => row.parentCode && !codes.has(row.parentCode));
  if (missingParent) throw new Error(`Missing parent account ${missingParent.parentCode}.`);
  return true;
}

export const accountingReports = [
  "Chart of Accounts",
  "Account Mapping Report",
  "Account Role Report",
  "Journal Register",
  "Journal Detail Report",
  "General Ledger",
  "Account Activity",
  "Trial Balance",
  "Comparative Trial Balance",
  "Branch Trial Balance",
  "Monthly Account Movement",
  "Customer Control Reconciliation",
  "Supplier Control Reconciliation",
  "Inventory-to-GL Reconciliation",
  "Cashbook-to-GL Reconciliation",
  "VAT Ledger",
  "Failed Accounting Events",
  "Unposted Operational Transactions",
  "Manual Journal Report",
  "Backdated Journal Report",
  "Reversal Journal Report",
  "Control-Account Manual Posting Report",
  "Accounting Period Status",
  "Opening Balance Report",
  "Posting Diagnostics Report",
  "Accounting Audit Trail",
];
