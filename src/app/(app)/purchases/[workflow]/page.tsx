import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { purchasingReports } from "@/lib/purchasing";

const workflows: Record<string, { title: string; description: string; fields: string[]; controls: string }> = {
  requisitions: {
    title: "Purchase Requisitions",
    description: "Create internal purchase requests from branch demand, reorder alerts or manual product needs.",
    fields: ["Requisition number", "Branch", "Requested by", "Needed by", "Product", "Quantity", "Preferred supplier", "Reason", "Approval status"],
    controls: "Approved requisitions can be converted into purchase orders while preserving source demand and approval history.",
  },
  "purchase-orders": {
    title: "Purchase Orders",
    description: "Build supplier orders from requisitions, reorder recommendations or direct purchasing.",
    fields: ["PO number", "Supplier", "Branch", "Expected date", "Product", "Order quantity", "Unit price", "Tax code", "Delivery terms"],
    controls: "Price changes beyond tolerance require reapproval, and sent purchase orders remain immutable except through controlled revisions.",
  },
  "goods-received": {
    title: "Goods Received Notes",
    description: "Receive goods against purchase orders with quantity, batch, expiry and quality inspection details.",
    fields: ["GRN number", "PO number", "Supplier", "Received date", "Product", "Received quantity", "Accepted quantity", "Rejected quantity", "Batch", "Expiry date"],
    controls: "Posted GRNs create purchase receipt stock movements, update inventory balances and preserve rejected or quarantined quantities.",
  },
  "supplier-bills": {
    title: "Supplier Bills",
    description: "Capture supplier invoices and run two-way or three-way matching before posting creditor balances.",
    fields: ["Bill number", "Supplier invoice", "Supplier", "PO number", "GRN number", "Invoice date", "Due date", "Subtotal", "Tax", "Total"],
    controls: "Quantity, price, tax, missing GRN and overbilling exceptions block posting until approved override permissions are used.",
  },
  returns: {
    title: "Supplier Returns",
    description: "Return rejected, damaged, expired, excess or recalled goods and track supplier credit recovery.",
    fields: ["Return number", "Supplier", "Source GRN", "Product", "Return quantity", "Reason", "Dispatch date", "Credit note expected"],
    controls: "Approved returns can reverse stock, create debit or credit note tracking and close once acknowledged by the supplier.",
  },
  payments: {
    title: "Supplier Payments",
    description: "Prepare, approve, post and allocate supplier payments across open bills and advances.",
    fields: ["Payment number", "Supplier", "Payment date", "Method", "Reference", "Amount", "Currency", "Bill allocation", "Approval status"],
    controls: "Allocations are validated against payment amount, bill outstanding balance and oldest-due allocation rules.",
  },
  "creditor-ageing": {
    title: "Creditor Ageing",
    description: "Review supplier balances by current, 1-30, 31-60, 61-90 and over-90 day due buckets.",
    fields: ["As-of date", "Supplier", "Branch", "Currency", "Current", "1-30", "31-60", "61-90", "Over 90"],
    controls: "Ageing is computed from posted bills, payments, credit notes, debit notes, advances and opening balances.",
  },
  reports: {
    title: "Purchasing Reports",
    description: "Run supplier, purchasing, receiving, billing, matching, returns, payment and creditor reports.",
    fields: ["Report", "Date range", "Branch", "Supplier", "Status", "Currency", "Export format"],
    controls: `${purchasingReports.length} purchasing reports are registered for owner and accountant reporting permissions.`,
  },
  imports: {
    title: "Supplier Imports",
    description: "Upload suppliers, price lists, opening balances, purchase orders and historical bills through validation batches.",
    fields: ["Import type", "File", "Branch", "Duplicate handling", "Validation status", "Rows accepted", "Rows rejected"],
    controls: "Imports remain draft until row-level validation passes and a manager or owner posts the batch.",
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function PurchasingWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Purchasing workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <form action={completeProcessAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Purchasing" />
        <input type="hidden" name="process" value={config.title} />
        <input type="hidden" name="returnTo" value={`/purchases/${workflow}`} />
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
          <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save as draft</button>
          <button name="intent" value="Validation previewed" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview validation</button>
          <button name="intent" value="Submitted for approval" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Submit for approval</button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Ledger controls</h2>
        <p className="mt-2 text-sm text-slate-600">{config.controls}</p>
      </section>
    </div>
  );
}
