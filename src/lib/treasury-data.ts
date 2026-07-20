import { treasuryReports } from "./treasury";

export const treasurySummary = {
  totalCashAvailable: "KES 0.00",
  bankBalances: "KES 0.00",
  mpesaBalances: "KES 0.00",
  cashHeldByDrivers: "KES 0.00",
  cashInTransit: "KES 0.00",
  unidentifiedReceipts: 0,
  unreconciledTransactions: 0,
  pendingBankDeposits: 0,
  pendingTransfers: 0,
  pettyCashBalances: "KES 0.00",
  staffAdvancesOutstanding: "KES 0.00",
  ownerCurrentAccountBalance: "KES 0.00",
};

export const accountTypes = [
  "Cash Account",
  "Petty Cash",
  "Bank Account",
  "M-Pesa Paybill",
  "M-Pesa Till",
  "M-Pesa Wallet",
  "Other Mobile Money",
  "Card Settlement Account",
  "Cheque Clearing",
  "Cash in Transit",
  "Driver Cash Custody",
  "Customer Collection Clearing",
  "Supplier Payment Clearing",
  "Owner Current Account",
  "Staff Advance Account",
  "Other Financial Account",
];

export const treasuryWorkflows = [
  { title: "Financial accounts", href: "/cash-bank/accounts", description: "Manage cash, bank, M-Pesa, tills, paybills, custody, clearing, owner and staff-advance accounts." },
  { title: "Cashbook", href: "/cash-bank/cashbook", description: "View money in, money out, source module, running balances and reconciliation status." },
  { title: "Receipts", href: "/cash-bank/receipts", description: "Record legitimate non-customer receipts without duplicating customer-payment receipts." },
  { title: "Payments", href: "/cash-bank/payments", description: "Record general payments outside supplier-bill settlement with approval thresholds." },
  { title: "Expenses", href: "/cash-bank/expenses", description: "Record paid expenses, claimable expenses, route expenses and split-cost foundations." },
  { title: "Expense claims", href: "/cash-bank/expense-claims", description: "Submit, review, approve, reimburse and close staff expense claims." },
  { title: "Petty cash", href: "/cash-bank/petty-cash", description: "Manage floats, vouchers, top-ups, returns, counts and petty-cash reconciliation." },
  { title: "Deposits and withdrawals", href: "/cash-bank/deposits-withdrawals", description: "Move cash to bank and bank to cash with linked ledger entries and verification." },
  { title: "Account transfers", href: "/cash-bank/transfers", description: "Transfer funds between cash, bank, M-Pesa, petty cash and clearing accounts." },
  { title: "Cheques", href: "/cash-bank/cheques", description: "Track received, issued, deposited, cleared, bounced, stale and cancelled cheques." },
  { title: "Owner transactions", href: "/cash-bank/owner-transactions", description: "Separate capital, loans, drawings, repayments and reimbursements in an owner-current ledger." },
  { title: "Staff advances", href: "/cash-bank/staff-advances", description: "Issue advances, review surrenders, record refunds and monitor overdue balances." },
  { title: "Statement imports", href: "/cash-bank/imports", description: "Import bank, M-Pesa and mobile-money statements with duplicate detection and row errors." },
  { title: "Reconciliation", href: "/cash-bank/reconciliation", description: "Match statement lines to ledger transactions and resolve unreconciled differences." },
  { title: "Cash counts", href: "/cash-bank/cash-counts", description: "Count physical cash by denomination and route cash variances through approval." },
  { title: "Forecast", href: "/cash-bank/forecast", description: "Project short-term cashflow from current system records for 7, 14, 30 and 90 days." },
  { title: "Reports", href: "/cash-bank/reports", description: `${treasuryReports.length} account, cashbook, expense, reconciliation, owner, advance and cashflow reports.` },
];

export const expenseCategories = [
  "Rent",
  "Electricity",
  "Water",
  "Internet",
  "Telephone",
  "Fuel",
  "Vehicle Repair",
  "Delivery Expense",
  "Marketing",
  "Travel",
  "Office Supplies",
  "Bank Charges",
  "M-Pesa Charges",
  "Insurance",
  "Taxes and Levies",
  "Other",
];

export const reconciliationMatchTypes = ["One-to-one", "One-to-many", "Many-to-one", "Partial", "Manual"];
