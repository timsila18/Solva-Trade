import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { accountingReports, defaultKenyanSmeAccounts, defaultRoleMappings } from "@/lib/accounting";
import { diagnosticTypes, journalTypes, setupWizardSteps } from "@/lib/accounting-data";

const workflows: Record<string, { title: string; description: string; fields: string[]; sideTitle: string; sideItems: string[]; controls: string }> = {
  setup: {
    title: "Accounting Setup Wizard",
    description: "Guide owners through accounting basics, financial years, recommended chart, role mappings, opening balances and activation.",
    fields: ["Accounting basis", "Default currency", "Financial year start", "Use recommended chart", "Import custom chart", "Critical mappings", "Opening balance date", "Activation readiness"],
    sideTitle: "Wizard steps",
    sideItems: setupWizardSteps,
    controls: "Accounting activates only after critical roles, periods, control accounts and opening-balance checks pass.",
  },
  "chart-of-accounts": {
    title: "Chart of Accounts",
    description: "Maintain account hierarchy, classes, control-account flags, posting status, normal balances and reporting sections.",
    fields: ["Account code", "Account name", "Account class", "Account type", "Parent account", "Normal balance", "Control account", "Posting account", "Cash-flow category", "Statement section"],
    sideTitle: "Recommended accounts",
    sideItems: defaultKenyanSmeAccounts.slice(0, 12).map((account) => `${account.code} ${account.name}`),
    controls: "Header accounts cannot receive postings, circular parents are blocked, and accounts with journal history are archived instead of deleted.",
  },
  "account-roles": {
    title: "Account Roles",
    description: "Map operational roles such as Customer Receivables, Inventory Asset and Output VAT to actual chart accounts.",
    fields: ["Role", "Mapped account", "Branch restriction", "Effective start", "Effective end", "System protected", "Status"],
    sideTitle: "Critical roles",
    sideItems: defaultRoleMappings.slice(0, 14).map((mapping) => mapping.role),
    controls: "Posting rules use account roles, not fixed account codes, so each business can adapt its chart.",
  },
  "account-mappings": {
    title: "Account Mappings",
    description: "Resolve accounts by transaction, product, category, customer, supplier, branch, tax code, payment account or business default.",
    fields: ["Mapping type", "Scope", "Role", "Account", "Priority", "Effective dates", "Conflict check", "Status"],
    sideTitle: "Precedence",
    sideItems: ["Transaction override", "Product mapping", "Product category", "Customer or supplier", "Branch", "Tax code", "Payment account", "Business default"],
    controls: "Conflicting active mappings at the same priority and scope are blocked before posting.",
  },
  "financial-years": {
    title: "Financial Years",
    description: "Plan, open, close and reopen financial years while preserving historical reporting periods.",
    fields: ["Year name", "Start date", "End date", "Status", "Current year", "Closed by", "Reopen reason", "Notes"],
    sideTitle: "Statuses",
    sideItems: ["Planned", "Open", "Closing", "Closed", "Reopened", "Archived"],
    controls: "Only one current financial year is allowed and overlapping active years are blocked.",
  },
  periods: {
    title: "Accounting Periods",
    description: "Manage monthly, four-week, quarterly or custom periods and lock modules independently.",
    fields: ["Period name", "Period type", "Start date", "End date", "Sequence", "Status", "Sales lock", "Purchasing lock", "Inventory lock", "Cash lock", "GL lock"],
    sideTitle: "Controls",
    sideItems: ["Open", "Soft close", "Hard close", "Reopen", "Backdated approval", "Blocked posting log"],
    controls: "Posting dates must belong to an open, soft-closed or reopened period; closed periods reject normal postings.",
  },
  "posting-queue": {
    title: "Posting Queue",
    description: "Review accounting events from sales, purchases, inventory, distribution and treasury before or after posting.",
    fields: ["Status", "Source module", "Source type", "Reference", "Event date", "Posting date", "Amount", "Tax", "Cost", "Retry count", "Failure reason"],
    sideTitle: "Queue states",
    sideItems: ["Pending", "Validating", "Ready", "Posted", "Partially Posted", "Failed", "Reversed", "Cancelled", "Needs Review"],
    controls: "Users can retry or cancel unposted events, but cannot force-post an unbalanced event.",
  },
  "manual-journals": {
    title: "Manual Journals",
    description: "Create, validate, approve and post manual journals with balanced debit and credit totals.",
    fields: ["Journal type", "Date", "Posting date", "Reference", "Description", "Account", "Debit", "Credit", "Customer or supplier detail", "Attachment"],
    sideTitle: "Journal types",
    sideItems: journalTypes,
    controls: "Manual postings to control accounts require detail and a separate permission.",
  },
  "opening-balances": {
    title: "Opening Balances",
    description: "Post balanced opening journals for accounts, customers, suppliers, stock, cash, owner and staff-advance balances.",
    fields: ["Opening date", "Account", "Debit", "Credit", "Customer", "Supplier", "Product", "Warehouse", "Reference", "Validation status"],
    sideTitle: "Sources",
    sideItems: ["Manual entry", "Chart import", "Journal import", "Customer opening", "Supplier opening", "Stock opening", "Cash opening"],
    controls: "Opening entries must balance to Opening Balance Equity before accounting activation.",
  },
  reversals: {
    title: "Reversals",
    description: "Create offsetting journals for posted entries without editing historical journal lines.",
    fields: ["Original journal", "Reversal date", "Reason", "Source status", "Approval", "Reversal journal", "Audit record"],
    sideTitle: "Rules",
    sideItems: ["Posted only", "Reason required", "No duplicate reversal", "Source link retained", "Full offset", "Audit trail"],
    controls: "A reversal journal swaps debits and credits and references the original entry.",
  },
  "general-ledger": {
    title: "General Ledger",
    description: "Run account-level ledger activity with running balances and drill-down to journals and source documents.",
    fields: ["Financial year", "Period", "Date range", "Account", "Account class", "Branch", "Customer", "Supplier", "Product", "Route", "Vehicle", "Source module", "Search"],
    sideTitle: "Exports",
    sideItems: ["PDF", "Print", "CSV", "Excel-compatible", "Journal drill-down", "Source drill-down"],
    controls: "The ledger includes only posted and reversal journals, never draft entries.",
  },
  "trial-balance": {
    title: "Trial Balance",
    description: "View period, comparative, branch and consolidated trial balances from posted journal lines.",
    fields: ["Financial year", "Period", "Date range", "Branch", "Account class", "Zero-balance suppression", "Adjusted view", "Export format"],
    sideTitle: "Views",
    sideItems: ["Unadjusted", "Adjusted foundation", "Period", "Comparative", "Branch", "Consolidated"],
    controls: "Total closing debits and credits are clearly flagged if they do not balance.",
  },
  "journal-register": {
    title: "Journal Register",
    description: "Review all journal headers by type, source, status, approval and reversal state.",
    fields: ["Journal type", "Date range", "Source", "Reference", "Status", "Approval", "Posted by", "Reversal status", "Search"],
    sideTitle: "Registers",
    sideItems: journalTypes,
    controls: "Journal totals are refreshed from lines and must remain balanced before posting.",
  },
  reconciliation: {
    title: "Subledger Reconciliation",
    description: "Compare general-ledger balances to operational customer, supplier, inventory, cash, VAT, owner, staff and packaging ledgers.",
    fields: ["Reconciliation type", "Account", "Period", "GL balance", "Subledger balance", "Difference", "Unposted events", "Failed events", "Reviewer", "Notes"],
    sideTitle: "Centres",
    sideItems: ["Customer receivables", "Supplier payables", "Inventory", "Cash and bank", "M-Pesa", "VAT", "Driver cash", "Packaging deposits"],
    controls: "Cashbook-to-GL reconciliation is separate from bank-statement reconciliation.",
  },
  diagnostics: {
    title: "Posting Diagnostics",
    description: "Detect accounting defects and guide users to the safest correction path.",
    fields: ["Severity", "Code", "Source module", "Source transaction", "Journal", "Event", "Suggested action", "Assigned user", "Status"],
    sideTitle: "Diagnostics",
    sideItems: diagnosticTypes,
    controls: "Missing mappings mark events Needs Review instead of silently posting to suspense.",
  },
  imports: {
    title: "Accounting Imports",
    description: "Import chart-of-accounts and journal batches through templates, mapping, validation, preview and commit.",
    fields: ["Import type", "File", "Column mapping", "Rows", "Valid rows", "Error rows", "Preview", "Duplicate references", "Commit status"],
    sideTitle: "Workflow",
    sideItems: ["Download template", "Upload", "Map columns", "Validate", "Preview hierarchy", "Fix errors", "Commit", "Results"],
    controls: "Journal imports are drafts by default and must balance per journal group.",
  },
  reports: {
    title: "Accounting Reports",
    description: "Run accounting, mapping, ledger, trial balance, reconciliation, diagnostics and audit reports.",
    fields: ["Report", "Financial year", "Period", "Date range", "Branch", "Account", "Source module", "Status", "Search", "Export format"],
    sideTitle: "Reports",
    sideItems: accountingReports.slice(0, 14),
    controls: `${accountingReports.length} reports are registered for PDF, CSV, Excel-compatible and print workflows.`,
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function AccountingWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Accounting workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Accounting" />
          <input type="hidden" name="process" value={config.title} />
          <input type="hidden" name="returnTo" value={`/accounting/${workflow}`} />
          <input type="hidden" name="next" value={`Continue ${config.title}`} />
          <div className="grid gap-4 md:grid-cols-2">
            {config.fields.map((field) => (
              <label key={field} className="text-sm font-medium">
                {field}
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={field} />
              </label>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save draft</button>
            <button name="intent" value="Validated" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Validate</button>
            <button name="intent" value="Submitted" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Submit</button>
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
