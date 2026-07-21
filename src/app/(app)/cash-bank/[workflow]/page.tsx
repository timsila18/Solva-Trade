import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { treasuryReports } from "@/lib/treasury";
import { accountTypes, expenseCategories, reconciliationMatchTypes } from "@/lib/treasury-data";

const workflows: Record<string, { title: string; description: string; fields: string[]; sideTitle: string; sideItems: string[]; controls: string }> = {
  accounts: {
    title: "Financial Accounts",
    description: "Create and manage cash, petty cash, bank, M-Pesa, mobile-money, clearing, owner-current and staff-advance accounts.",
    fields: ["Account name", "Account code", "Account type", "Branch", "Currency", "Provider", "Masked account number", "Minimum balance", "Approval threshold", "Responsible user"],
    sideTitle: "Account types",
    sideItems: accountTypes,
    controls: "Sensitive account details are masked unless the user has full-account-details permission. Branch accounts remain branch restricted.",
  },
  cashbook: {
    title: "Cashbook",
    description: "View money in, money out, account, counterparty, source module, approval, reconciliation and running balance.",
    fields: ["Date range", "Branch", "Account", "Transaction type", "Payment method", "Counterparty", "Source module", "Approval status", "Reconciliation status", "Amount range"],
    sideTitle: "Cashbook views",
    sideItems: ["By account", "Combined cashbook", "Daily cashbook", "Monthly cashbook", "Print view", "CSV export"],
    controls: "The financial-account ledger is the source of truth; balances are summaries that reconcile back to ledger rows.",
  },
  receipts: {
    title: "General Receipts",
    description: "Record legitimate receipts outside normal customer-invoice allocation.",
    fields: ["Receipt number", "Receipt date", "Account", "Received from", "Amount", "Payment method", "Reference", "Category", "Tax treatment", "Description"],
    sideTitle: "Use cases",
    sideItems: ["Miscellaneous income", "Interest received", "Insurance refund", "Owner capital", "Owner loan", "Supplier refund"],
    controls: "Customer invoice receipts should use customer payments; posted general receipts require reversal.",
  },
  payments: {
    title: "General Payments",
    description: "Record payments outside supplier-bill settlement with threshold approval and reversal controls.",
    fields: ["Payment number", "Payment date", "Account", "Paid to", "Amount", "Payment method", "Reference", "Category", "Withholding tax", "Description"],
    sideTitle: "Payment controls",
    sideItems: ["Approval threshold", "Attachment", "Tax treatment", "Withholding tax", "Reversal only", "Accounting event"],
    controls: "Supplier-bill settlements remain in the supplier-payment workflow; this page handles legitimate general disbursements.",
  },
  expenses: {
    title: "Expenses",
    description: "Record paid operating expenses, reimbursable expenses, recurring foundations and split-cost details.",
    fields: ["Expense number", "Date", "Category", "Payee", "Supplier", "Account", "Amount", "Tax", "Vehicle", "Route", "Attachment"],
    sideTitle: "Categories",
    sideItems: expenseCategories,
    controls: "Unpaid supplier expenses should use supplier bills where appropriate.",
  },
  "expense-claims": {
    title: "Expense Claims",
    description: "Submit, approve, reimburse and close staff expense claims.",
    fields: ["Claim number", "Employee", "Branch", "Period start", "Period end", "Purpose", "Total claimed", "Approved amount", "Payment reference"],
    sideTitle: "Workflow",
    sideItems: ["Draft", "Submitted", "Pending Approval", "Approved", "Rejected", "Paid", "Closed"],
    controls: "Self-approval can be blocked by approval policy before reimbursement is posted.",
  },
  "petty-cash": {
    title: "Petty Cash",
    description: "Manage petty-cash accounts, custodians, vouchers, top-ups, returns, counts and reconciliation.",
    fields: ["Account", "Custodian", "Float amount", "Reorder level", "Voucher number", "Payee", "Purpose", "Amount", "Receipt"],
    sideTitle: "Petty-cash actions",
    sideItems: ["Float issue", "Payment", "Top-up", "Return", "Count", "Reconciliation", "Variance"],
    controls: "Significant petty-cash variances require explanation and approval.",
  },
  "deposits-withdrawals": {
    title: "Deposits and Withdrawals",
    description: "Post cash-to-bank deposits and bank-to-cash withdrawals with linked ledger entries.",
    fields: ["Document number", "Date", "Cash account", "Bank account", "Amount", "Reference", "Slip or cheque number", "Prepared by", "Verified by"],
    sideTitle: "Controls",
    sideItems: ["Duplicate posting prevention", "Partial deposit", "Retained float", "Attachment", "Verification", "Audit trail"],
    controls: "Deposits decrease cash and increase bank; withdrawals reduce bank and increase cash.",
  },
  transfers: {
    title: "Account Transfers",
    description: "Move money between cash, bank, M-Pesa, petty cash, clearing and branch accounts.",
    fields: ["Transfer number", "From account", "To account", "Date", "Amount sent", "Fees", "Amount received", "Currency", "Exchange rate", "Reference"],
    sideTitle: "Transfer examples",
    sideItems: ["Bank to bank", "M-Pesa to bank", "Cash to bank", "Bank to petty cash", "Cash to branch cash"],
    controls: "Same-account transfers are blocked and cross-currency transfers require an exchange-rate workflow.",
  },
  cheques: {
    title: "Cheques",
    description: "Track received, issued, post-dated, deposited, cleared, bounced, cancelled, stale and replaced cheques.",
    fields: ["Cheque number", "Bank", "Drawer or payee", "Customer or supplier", "Amount", "Cheque date", "Deposit date", "Clearance date", "Status"],
    sideTitle: "Statuses",
    sideItems: ["Received", "Issued", "Post-Dated", "Deposited", "Cleared", "Bounced", "Cancelled", "Stale"],
    controls: "Customer cheques are not treated as cleared cash until the configured recognition point.",
  },
  "owner-transactions": {
    title: "Owner Transactions",
    description: "Separate owner capital, owner loans, drawings, repayments, reimbursements and personal payments.",
    fields: ["Transaction number", "Owner", "Type", "Date", "Amount", "Account", "Related expense", "Description", "Attachment", "Approval status"],
    sideTitle: "Owner ledger",
    sideItems: ["Capital", "Loan balance", "Drawings", "Reimbursements", "Owner owes business", "Business owes owner"],
    controls: "Owner withdrawals are not automatically labelled as expenses and require clear supporting context.",
  },
  "staff-advances": {
    title: "Staff Advances",
    description: "Issue advances, track expected surrender dates, review expense surrenders and refunds.",
    fields: ["Advance number", "Staff member", "Purpose", "Date issued", "Amount", "Account", "Expected surrender", "Cash returned", "Outstanding amount"],
    sideTitle: "Advance types",
    sideItems: ["Travel", "Route", "Purchasing", "Petty cash", "Project", "Emergency"],
    controls: "Outstanding balances are tracked until fully surrendered, refunded, cancelled or reversed.",
  },
  imports: {
    title: "Statement Imports",
    description: "Import bank, M-Pesa, mobile-money, opening balance, expense, owner and staff-advance files.",
    fields: ["Import type", "Account", "File", "Column mapping", "Rows", "Valid rows", "Error rows", "Duplicate handling", "Commit status"],
    sideTitle: "Import workflow",
    sideItems: ["Template", "Upload", "Map", "Validate", "Preview", "Correct", "Commit", "Results"],
    controls: "Imports keep immutable batch, row and statement-line history with row-level validation errors.",
  },
  reconciliation: {
    title: "Bank and M-Pesa Reconciliation",
    description: "Match statement lines to ledger transactions and resolve differences, duplicates and unidentified receipts.",
    fields: ["Reconciliation number", "Account", "Type", "Period start", "Period end", "Statement balance", "Ledger balance", "Matched amount", "Difference"],
    sideTitle: "Match types",
    sideItems: reconciliationMatchTypes,
    controls: "Statement lines can be one-to-one, one-to-many, many-to-one, partial or manual matches.",
  },
  "cash-counts": {
    title: "Cash Counts",
    description: "Record physical cash counts by denomination and route variances to approval.",
    fields: ["Count number", "Cash account", "Branch", "Count time", "Custodian", "Expected balance", "Counted balance", "Variance", "Notes"],
    sideTitle: "Cash controls",
    sideItems: ["Denomination breakdown", "Variance found", "Approval", "Daily cash-up", "Audit trail"],
    controls: "Shortages and surpluses are posted as separate ledger transactions and are never silently absorbed.",
  },
  forecast: {
    title: "Short-Term Cashflow Forecast",
    description: "Forecast 7, 14, 30 and 90 day cashflow from current system records.",
    fields: ["Period", "Opening available cash", "Expected inflows", "Expected outflows", "Closing cash", "Lowest point", "Funding gap", "Surplus"],
    sideTitle: "Forecast inputs",
    sideItems: ["Customer invoices due", "Route collections", "Supplier bills", "Recurring expenses", "Owner funding", "Loan repayments"],
    controls: "Forecasts are based on current system records, not certainty.",
  },
  reports: {
    title: "Treasury Reports",
    description: "Run financial account, cashbook, receipt, payment, expense, reconciliation, owner, advance and forecast reports.",
    fields: ["Report", "Date range", "Branch", "Account", "Transaction type", "Counterparty", "Approval", "Reconciliation", "Currency", "Export format"],
    sideTitle: "Reports",
    sideItems: treasuryReports.slice(0, 12),
    controls: `${treasuryReports.length} treasury reports are registered for PDF, CSV, Excel-compatible and print workflows.`,
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function CashBankWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Cash & Bank workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Cash and Bank" />
          <input type="hidden" name="process" value={config.title} />
          <input type="hidden" name="returnTo" value={`/cash-bank/${workflow}`} />
          <input type="hidden" name="next" value={`Continue ${config.title}`} />
          <WorkflowFormFields fields={config.fields} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save draft</button>
            <button name="intent" value="Checks previewed" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview checks</button>
            <button name="intent" value="Posted or submitted" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Post or submit</button>
          </div>
        </form>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">{config.sideTitle}</h2>
          <div className="mt-3 space-y-2">
            {config.sideItems.map((item) => (
              <div key={item} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{item}</div>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Control design</h2>
        <p className="mt-2 text-sm text-slate-600">{config.controls}</p>
      </section>
    </div>
  );
}
