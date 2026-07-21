import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { financialReports } from "@/lib/financial-reporting";
import { closeTasks } from "@/lib/financial-reporting-data";

const workflows: Record<string, { title: string; description: string; fields: string[]; sideTitle: string; sideItems: string[]; controls: string }> = {
  "profit-and-loss": {
    title: "Profit and Loss",
    description: "Generate revenue, cost of sales, gross profit, expenses, operating profit and profit after expenses from posted journal lines.",
    fields: ["Layout", "Financial year", "Period", "Date range", "Branch", "Comparative mode", "Budget version", "Show percentages", "Zero balances", "Export format"],
    sideTitle: "Sections",
    sideItems: ["Revenue", "Net Revenue", "Cost of Sales", "Gross Profit", "Operating Expenses", "Operating Profit", "Other Income", "Profit After Expenses"],
    controls: "Draft, rejected, cancelled and failed entries are excluded. Reversal journals are included by posting date.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description: "Show assets, liabilities, equity and dynamic current-year earnings with imbalance diagnostics.",
    fields: ["Layout", "As-of date", "Comparative date", "Branch", "Currency", "Show account codes", "Show zero balances", "Rounding", "Export format"],
    sideTitle: "Diagnostics",
    sideItems: ["Assets equal liabilities plus equity", "Current-year earnings check", "Retained earnings check", "Suspense balance", "Opening-balance imbalance"],
    controls: "Current-year earnings are calculated from Profit and Loss accounts until year-end transfer is posted.",
  },
  "cash-flow": {
    title: "Cash Flow Statement",
    description: "Prepare indirect-method operating, investing and financing cash flow using account cash-flow classifications.",
    fields: ["Layout", "Period", "Opening cash", "Cash-equivalent policy", "Overdraft treatment", "Comparative mode", "Branch", "Export format"],
    sideTitle: "Sections",
    sideItems: ["Operating activities", "Working capital", "Investing activities", "Financing activities", "Net cash movement", "Cash reconciliation"],
    controls: "Internal transfers between cash accounts are excluded from net cash movement where both accounts are cash equivalents.",
  },
  "changes-in-equity": {
    title: "Statement of Changes in Equity",
    description: "Track owner capital, drawings, current-year profit, retained earnings transfers, reserves and prior adjustments.",
    fields: ["Financial year", "Comparative year", "Owner", "Opening equity", "Capital introduced", "Drawings", "Profit after expenses", "Adjustments", "Export format"],
    sideTitle: "Movements",
    sideItems: ["Opening owner capital", "Additional capital", "Current-year profit or loss", "Owner drawings", "Prior-period adjustments", "Retained earnings transfer", "Closing equity"],
    controls: "Equity reporting remains consolidated and branch-independent unless a business explicitly tracks branch equity.",
  },
  "management-accounts": {
    title: "Management Accounts",
    description: "Build monthly, quarterly, annual or custom management packs with statements, commentary, risk notes and approval status.",
    fields: ["Pack name", "Pack type", "Period", "Prepared by", "Reviewed by", "Approved by", "Commentary section", "Status", "PDF status"],
    sideTitle: "Pack contents",
    sideItems: ["Executive summary", "Profit and Loss", "Balance Sheet", "Cash Flow", "Sales summary", "Margin analysis", "Expense summary", "Budget variance", "Key risks"],
    controls: "Commentary is stored per period and section so prior-period narratives are not overwritten.",
  },
  ratios: {
    title: "Financial Ratios",
    description: "Calculate profitability, liquidity, efficiency, leverage and growth ratios with transparent inputs.",
    fields: ["Ratio category", "Financial year", "Period", "Branch", "Threshold set", "Show inputs", "Comparison", "Export format"],
    sideTitle: "Ratio groups",
    sideItems: ["Gross Margin", "Operating Margin", "Net Profit Margin", "Current Ratio", "Quick Ratio", "Cash Ratio", "Debtor Days", "Debt-to-Equity"],
    controls: "Ratios show Not enough data where denominators are zero or negative and are not lending or investment advice.",
  },
  "working-capital": {
    title: "Working Capital",
    description: "Monitor customer debt, supplier debt, inventory, cash, advances and cash conversion cycle foundations.",
    fields: ["Period", "Branch", "Customer group", "Supplier group", "Inventory filter", "Overdue threshold", "Export format"],
    sideTitle: "Metrics",
    sideItems: ["Customer receivables", "Supplier payables", "Inventory", "Cash", "Supplier advances", "Staff advances", "Debtor days", "Cash conversion cycle"],
    controls: "Every metric links back to posted ledger balances or operational subledger reconciliation reports.",
  },
  "branch-performance": {
    title: "Branch Performance",
    description: "Compare branch revenue, margin, expenses, cash, inventory, working capital and budget variance.",
    fields: ["Financial year", "Period", "Branch group", "Comparative mode", "Budget version", "Unallocated lines", "Export format"],
    sideTitle: "Branch views",
    sideItems: ["Revenue", "Gross profit", "Expenses", "Operating profit", "Receivables", "Payables", "Inventory", "Cash", "Unallocated"],
    controls: "Journal lines without branch dimensions are shown separately rather than forced into a branch.",
  },
  "product-profitability": {
    title: "Product Profitability",
    description: "Measure net revenue, cost of goods sold, gross profit, discounts, returns and contribution foundations by product.",
    fields: ["Product", "Variant", "Category", "Brand", "Branch", "Customer group", "Route", "Period", "Export format"],
    sideTitle: "Measures",
    sideItems: ["Sales quantity", "Net revenue", "Cost of goods sold", "Gross profit", "Gross margin", "Discounts", "Returns", "Damage and expiry cost"],
    controls: "Revenue and cost timing follow posted accounting entries.",
  },
  "customer-profitability": {
    title: "Customer Profitability",
    description: "Review customer revenue, gross profit, payment delay, outstanding balance and contribution foundations.",
    fields: ["Customer", "Customer group", "Branch", "Route", "Period", "Payment delay", "Bad-debt risk", "Export format"],
    sideTitle: "Measures",
    sideItems: ["Net sales", "Gross profit", "Gross margin", "Discounts", "Returns", "Outstanding balance", "Payment delay", "Contribution foundation"],
    controls: "Delivery and overhead costs are shown only when a configured allocation method exists.",
  },
  "route-vehicle": {
    title: "Route and Vehicle Profitability",
    description: "Track direct route and vehicle revenue, expenses, stock losses, packaging losses and contribution foundations.",
    fields: ["Route", "Vehicle", "Period", "Direct costs", "Allocation method", "Stock variance", "Packaging variance", "Export format"],
    sideTitle: "Foundations",
    sideItems: ["Route revenue", "Fuel", "Vehicle costs", "Driver cost placeholder", "Stock losses", "Packaging losses", "Direct costs", "Allocated estimates"],
    controls: "Direct costs and reporting-only allocations are clearly separated.",
  },
  budgets: {
    title: "Budgets",
    description: "Create budget versions, scenarios, imports, approvals, active budgets and actual-versus-budget reporting.",
    fields: ["Budget version", "Scenario", "Financial year", "Account", "Branch", "Period", "Quantity", "Unit price", "Amount", "Assumption"],
    sideTitle: "Workflow",
    sideItems: ["Draft", "Submit", "Approve", "Activate", "Revise", "Import", "Compare versions", "Actual versus budget"],
    controls: "Approved and active budgets cannot be overwritten; revisions create new controlled versions.",
  },
  forecasts: {
    title: "Forecasts",
    description: "Create short-term cash, profit, rolling and scenario forecasts with assumption tracking.",
    fields: ["Forecast name", "Type", "Scenario", "Date range", "Metric", "Amount", "Assumptions", "Approval", "Supersedes"],
    sideTitle: "Forecast types",
    sideItems: ["Short-term cash", "Profit forecast", "Rolling forecast", "Scenario forecast", "Forecast versus budget", "Cash budget"],
    controls: "Forecasts are estimates linked to assumptions and do not automatically change budgets, prices or payments.",
  },
  "period-close": {
    title: "Period Close",
    description: "Run close tasks, soft close, hard close, reopen periods and generate close audit trails.",
    fields: ["Period", "Close status", "Assigned task", "Blocking", "Task status", "Waiver reason", "Override reason", "Snapshot status"],
    sideTitle: "Close tasks",
    sideItems: closeTasks,
    controls: "Hard close locks normal posting. Reopening requires permission, reason, audit trail and superseding statements.",
  },
  adjustments: {
    title: "Adjustments",
    description: "Prepare accruals, prepayments, depreciation schedules, provisions and cost allocations.",
    fields: ["Adjustment type", "Period", "Calculation basis", "Source amount", "Adjustment amount", "Approval", "Journal reference", "Notes"],
    sideTitle: "Foundations",
    sideItems: ["Accruals", "Prepayments", "Depreciation schedule", "Bad-debt provision", "Inventory provision", "Cost allocation"],
    controls: "Provision journals never change operational stock quantities or automatically write off customer debts.",
  },
  snapshots: {
    title: "Statement Snapshots",
    description: "Preserve immutable statement versions when packs are approved, periods close or reports are formally issued.",
    fields: ["Statement type", "Period", "Layout", "Generated by", "Approval status", "Data hash", "Report file", "Superseded by"],
    sideTitle: "Snapshot events",
    sideItems: ["Management pack approved", "Period hard closed", "Financial year closed", "Report pack issued", "Superseded statement"],
    controls: "Snapshots remain available after account names or layouts change.",
  },
  reports: {
    title: "Financial Reports",
    description: "Run statement, performance, budget, forecast, close, adjustment and snapshot reports.",
    fields: ["Report", "Financial year", "Period", "Date range", "Branch", "Product", "Customer", "Budget version", "Forecast version", "Export format"],
    sideTitle: "Reports",
    sideItems: financialReports.slice(0, 14),
    controls: `${financialReports.length} financial reports are registered for PDF, CSV, workbook and print workflows.`,
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function FinancialWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Financial workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Financials" />
          <input type="hidden" name="process" value={config.title} />
          <input type="hidden" name="returnTo" value={`/financials/${workflow}`} />
          <input type="hidden" name="next" value={`Continue ${config.title}`} />
          <WorkflowFormFields fields={config.fields} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save draft</button>
            <button name="intent" value="Preview generated" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview</button>
            <button name="intent" value="Generated" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Generate</button>
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
