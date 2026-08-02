import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { accountingReports, defaultKenyanSmeAccounts, defaultRoleMappings } from "@/lib/accounting";
import { diagnosticTypes, journalTypes, setupWizardSteps } from "@/lib/accounting-data";

const workflows: Record<string, { title: string; description: string; fields: string[]; sideTitle: string; sideItems: string[]; controls: string }> = {
  setup: {
    title: "Accounting Setup Wizard",
    description: "Guide owners through accounting basics, financial years, recommended chart, role mappings, opening balances and activation.",
    fields: ["Accounting basis", "Default currency", "Financial year start", "Use recommended chart", "Import custom chart", "Critical mappings", "Opening balance date", "Activation readiness"],
    sideTitle: "Setup checklist",
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

function fieldKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthBounds() {
  const today = todayDate();
  const year = today.slice(0, 4);
  const month = today.slice(5, 7);
  const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  return {
    name: new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric" }).format(new Date(`${today}T00:00:00`)),
    start: `${year}-${month}-01`,
    end,
  };
}

function currentYearBounds() {
  const year = todayDate().slice(0, 4);
  return {
    name: `FY ${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function accountingFormPlan(workflow: string, fields: string[]) {
  const today = todayDate();
  const month = currentMonthBounds();
  const year = currentYearBounds();
  const plan: { visibleFields: string[]; defaults: Record<string, string>; systemFields: Record<string, { label: string; value: string }>; button: string; note: string } = {
    visibleFields: fields,
    defaults: {},
    systemFields: {},
    button: "Save accounting record",
    note: "Solva fills the routine accounting controls so the owner only enters the facts that matter.",
  };

  function hide(label: string, value: string) {
    plan.systemFields[fieldKey(label)] = { label, value };
    plan.defaults[fieldKey(label)] = value;
  }

  function prefill(label: string, value: string) {
    plan.defaults[fieldKey(label)] = value;
  }

  if (workflow === "setup") {
    plan.visibleFields = ["Accounting basis", "Financial year start"];
    prefill("Accounting basis", "Accrual");
    prefill("Financial year start", year.start);
    hide("Default currency", "KES");
    hide("Use recommended chart", "Yes");
    hide("Import custom chart", "No");
    hide("Critical mappings", "Use Solva recommended Kenyan SME mappings");
    hide("Opening balance date", year.start);
    hide("Activation readiness", "Ready for owner review");
    plan.button = "Activate recommended accounting setup";
    plan.note = "Currency, recommended chart, critical mappings and opening-balance date are prepared by the system.";
  } else if (workflow === "chart-of-accounts") {
    plan.visibleFields = ["Account code", "Account name", "Account class", "Account type"];
    prefill("Account class", "Expenses");
    prefill("Account type", "Operating expense");
    hide("Parent account", "None");
    hide("Normal balance", "Debit");
    hide("Control account", "No");
    hide("Posting account", "Yes");
    hide("Cash-flow category", "Operations");
    hide("Statement section", "Profit and Loss Account");
    plan.button = "Create account";
    plan.note = "Parent, posting, cash-flow and statement settings use safe defaults for owner-created accounts.";
  } else if (workflow === "account-roles") {
    plan.visibleFields = ["Role", "Mapped account"];
    hide("Branch restriction", "All branches");
    hide("Effective start", today);
    hide("Effective end", "Open ended");
    hide("System protected", "Yes");
    hide("Status", "Active");
    plan.button = "Save account role";
  } else if (workflow === "account-mappings") {
    plan.visibleFields = ["Mapping type", "Role", "Account"];
    hide("Scope", "Business default");
    hide("Priority", "100");
    hide("Effective dates", `From ${today}`);
    hide("Conflict check", "System checked on save");
    hide("Status", "Active");
    plan.button = "Save account mapping";
  } else if (workflow === "financial-years") {
    plan.visibleFields = ["Year name", "Start date", "End date"];
    prefill("Year name", year.name);
    prefill("Start date", year.start);
    prefill("End date", year.end);
    hide("Status", "Open");
    hide("Current year", "Yes");
    hide("Closed by", "Not closed");
    hide("Reopen reason", "Not applicable");
    hide("Notes", "Created from owner quick setup");
    plan.button = "Open financial year";
  } else if (workflow === "periods") {
    plan.visibleFields = ["Period name", "Period type", "Start date", "End date"];
    prefill("Period name", month.name);
    prefill("Period type", "Monthly");
    prefill("Start date", month.start);
    prefill("End date", month.end);
    hide("Sequence", "1");
    hide("Status", "Open");
    hide("Sales lock", "No");
    hide("Purchasing lock", "No");
    hide("Inventory lock", "No");
    hide("Cash lock", "No");
    hide("GL lock", "No");
    plan.button = "Open accounting period";
  } else if (workflow === "manual-journals") {
    plan.visibleFields = ["Journal type", "Date", "Description", "Account", "Debit", "Credit"];
    prefill("Journal type", "General journal");
    prefill("Date", today);
    hide("Posting date", today);
    hide("Reference", `MJ-${Date.now().toString().slice(-8)}`);
    hide("Customer or supplier detail", "None");
    hide("Attachment", "Not attached");
    plan.button = "Post journal";
    plan.note = "Only the real journal facts are shown. Posting date and reference are filled automatically.";
  } else if (workflow === "opening-balances") {
    plan.visibleFields = ["Opening date", "Account", "Debit", "Credit"];
    prefill("Opening date", year.start);
    hide("Customer", "None");
    hide("Supplier", "None");
    hide("Product", "None");
    hide("Warehouse", "Main workspace");
    hide("Reference", `OPEN-${year.name.replace(/\D/g, "") || today.slice(0, 4)}`);
    hide("Validation status", "Balance check required");
    plan.button = "Save opening balance line";
  } else if (workflow === "reversals") {
    plan.visibleFields = ["Original journal", "Reversal date", "Reason"];
    prefill("Reversal date", today);
    hide("Source status", "Posted");
    hide("Approval", "Owner review");
    hide("Reversal journal", "System generated after save");
    hide("Audit record", "System generated");
    plan.button = "Prepare reversal";
  } else if (workflow === "reports" || workflow === "general-ledger" || workflow === "trial-balance" || workflow === "journal-register") {
    plan.visibleFields = workflow === "reports" ? ["Report", "Date range"] : ["Date range", "Account", "Search"];
    prefill("Date range", `${month.start} to ${today}`);
    hide("Financial year", year.name);
    hide("Period", month.name);
    hide("Branch", "Main workspace");
    hide("Account class", "All");
    hide("Source module", "All");
    hide("Status", "Posted");
    hide("Zero-balance suppression", "Hide zero balances");
    hide("Adjusted view", "Unadjusted");
    hide("Export format", "PDF");
    plan.button = "Generate report";
    plan.note = "Report period, branch, status and export format are prepared automatically. Change only the report or search filter when needed.";
  } else if (workflow === "posting-queue" || workflow === "diagnostics" || workflow === "reconciliation") {
    plan.visibleFields = fields.filter((field) => /status|source|reference|search|account|period|notes|type/i.test(field)).slice(0, 5);
    prefill("Status", "Needs review");
    prefill("Period", month.name);
    hide("Branch", "Main workspace");
    plan.button = "Review";
  }

  return plan;
}

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
  const formPlan = accountingFormPlan(workflow, config.fields);

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Accounting workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <PersistedForm action={completeProcessAction} draftKey={`solva-trade:workflow-draft:accounting:${workflow}`} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Accounting" />
          <input type="hidden" name="process" value={config.title} />
          <input type="hidden" name="returnTo" value={`/accounting/${workflow}`} />
          <input type="hidden" name="next" value={`Continue ${config.title}`} />
          {Object.entries(formPlan.systemFields).map(([key, field]) => (
            <span key={key} className="hidden">
              <input type="hidden" name={`label_${key}`} value={field.label} />
              <input type="hidden" name={`field_${key}`} value={field.value} />
            </span>
          ))}
          <div className="mb-5 rounded-lg border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-slate-700">
            {formPlan.note}
          </div>
          <WorkflowFormFields fields={formPlan.visibleFields} defaultValues={formPlan.defaults} />
          <div className="mt-6">
            <button name="intent" value={formPlan.button} className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">{formPlan.button}</button>
          </div>
        </PersistedForm>

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
