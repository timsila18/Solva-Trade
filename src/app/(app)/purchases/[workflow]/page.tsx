import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { purchasingReports } from "@/lib/purchasing";
import { getSalesWorkflowLookups } from "@/lib/workflow-live-data";

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
    fields: ["PO number", "Supplier", "Source type", "Source reason", "Branch", "Expected date", "Product", "Order quantity", "Unit price", "Direct reference unit cost", "Local reference unit cost", "Tax code", "Delivery terms"],
    controls: "Price changes beyond tolerance require reapproval, and sent purchase orders remain immutable except through controlled revisions.",
  },
  "goods-received": {
    title: "Goods Received Notes",
    description: "Receive goods against purchase orders with quantity, batch, expiry and quality inspection details.",
    fields: ["GRN number", "PO number", "Supplier", "Source type", "Source reason", "Received date", "Product", "Received quantity", "Accepted quantity", "Rejected quantity", "Unit cost", "Direct reference unit cost", "Local reference unit cost", "Batch", "Expiry date"],
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

const workflowDocuments: Record<string, string[]> = {
  requisitions: ["Purchase Requisition", "Request for Quotation (RFQ)"],
  "purchase-orders": ["Purchase Order (PO)", "Supplier Quotation Comparison"],
  "goods-received": ["Goods Received Note (GRN)", "Supplier Delivery Note", "Stock Movement Report"],
  "supplier-bills": ["Supplier Invoice Register", "Outstanding Supplier Balance Statement", "Supplier Statement"],
  returns: ["Purchase Return Note", "Supplier Statement"],
  payments: ["Payment Voucher", "Supplier Payment History", "Outstanding Supplier Balance Statement"],
  "creditor-ageing": ["Supplier Aging Report", "Outstanding Supplier Balance Statement"],
  reports: ["Purchase Source Profitability Report", "Direct vs Local Purchase Price Report", "Emergency Purchase Impact Report", "Supplier Price Comparison"],
  imports: ["Supplier Profile", "Supplier Purchase History"],
};

const primaryDocument: Record<string, string> = {
  requisitions: "Purchase Requisition",
  "purchase-orders": "Purchase Order (PO)",
  "goods-received": "Goods Received Note (GRN)",
  "supplier-bills": "Supplier Invoice Register",
  returns: "Purchase Return Note",
  payments: "Payment Voucher",
  "creditor-ageing": "Supplier Aging Report",
  reports: "Purchase Order (PO)",
  imports: "Supplier Profile",
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
  const lookups = await getSalesWorkflowLookups();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Purchasing workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <form action={completeProcessAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Purchasing" />
        <input type="hidden" name="process" value={config.title} />
        <input type="hidden" name="document" value={primaryDocument[workflow] ?? config.title} />
        <input type="hidden" name="returnTo" value={`/purchases/${workflow}`} />
        <input type="hidden" name="next" value={`Continue ${config.title}`} />
        <WorkflowFormFields fields={config.fields} products={lookups.products} suppliers={lookups.suppliers} autoFillProductPrice={false} />
        <div className="mt-6 flex flex-wrap gap-3">
          <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save as draft</button>
          <button name="intent" value="Validation previewed" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview validation</button>
          <button name="intent" value={workflow === "goods-received" ? "Posted and received" : "Submitted for approval"} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            {workflow === "goods-received" ? "Post GRN and receive stock" : "Submit for approval"}
          </button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Ledger controls</h2>
        <p className="mt-2 text-sm text-slate-600">{config.controls}</p>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Download documents</p>
            <h2 className="mt-1 text-xl font-semibold">
              {workflow === "goods-received" ? "GRN and receiving documents" : "Available after this purchasing step"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Documents include tenant logo, Solva Trade branding, faint watermark, supplier details, quantities, approvals and audit context.
            </p>
          </div>
          <a href="/reports" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Open centre</a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(workflowDocuments[workflow] ?? ["Purchasing Reports"]).map((document) => {
            const base = `/api/exports?module=Purchasing&process=${encodeURIComponent(document)}`;
            return (
              <article key={document} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-950">{document}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Ready in PDF, Excel and print format from this workspace.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`${base}&format=pdf`} className="inline-flex items-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-3 py-2 text-xs font-semibold text-white">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                  <a href={`${base}&format=excel`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Excel</a>
                  <a href={`${base}&format=print`} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
