import { notFound } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { getSalesWorkflowLookups } from "@/lib/workflow-live-data";

const workflows: Record<string, { title: string; description: string; fields: string[] }> = {
  quotations: {
    title: "Quotations",
    description: "Prepare customer quotations. Solva generates the quotation number automatically.",
    fields: ["Customer", "Date", "Valid until", "Product", "Quantity", "Price", "Discount", "Tax", "Total"],
  },
  orders: {
    title: "Sales Orders",
    description: "Approve customer demand and expose ready orders to delivery planning. Solva generates the sales order number.",
    fields: ["Customer", "Route", "Delivery date", "Payment status", "Product", "Ordered quantity", "Delivery priority"],
  },
  invoices: {
    title: "Invoices",
    description: "Record the sale and create the customer invoice first. Payment confirmation later generates the receipt.",
    fields: ["Customer", "Product", "Quantity", "Unit price", "Discount"],
  },
  payments: {
    title: "Customer Payments",
    description: "Record customer payments and allocations that delivery collections can reuse. Solva generates the payment and receipt numbers.",
    fields: ["Customer", "Invoice", "Payment method", "Amount", "Reference", "Payer name", "Receipt status"],
  },
  returns: {
    title: "Customer Returns",
    description: "Create return and credit workflows for rejected or returned delivery items. Solva generates the return or credit note number.",
    fields: ["Customer", "Invoice", "Product", "Returned quantity", "Reason", "Disposition", "Credit required"],
  },
  "debtor-ageing": {
    title: "Debtor Ageing",
    description: "Monitor customer balances by due-date bucket.",
    fields: ["As-of date", "Customer", "Route", "Branch", "Current", "1-30", "31-60", "61-90", "Over 90"],
  },
};

const workflowDocuments: Record<string, string[]> = {
  quotations: ["Quotation", "Proforma Invoice"],
  orders: ["Sales Order", "Dispatch Note", "Delivery Note"],
  invoices: ["Invoice", "Simplified Invoice", "Delivery Note", "Customer Statement"],
  payments: ["Sales Receipt", "Receipt Voucher", "Outstanding Balance Statement"],
  returns: ["Sales Return Note", "Credit Note"],
  "debtor-ageing": ["Customer Aging Report", "Outstanding Balance Statement", "Customer Statement"],
};

const primaryDocument: Record<string, string> = {
  quotations: "Quotation",
  orders: "Sales Order",
  invoices: "Invoice",
  payments: "Sales Receipt",
  returns: "Credit Note",
  "debtor-ageing": "Customer Aging Report",
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function SalesWorkflowPage({
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
      <p className="text-sm font-semibold text-emerald-700">Sales workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <form action={completeProcessAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Sales" />
        <input type="hidden" name="process" value={config.title} />
        <input type="hidden" name="document" value={primaryDocument[workflow] ?? config.title} />
        <input type="hidden" name="returnTo" value={`/sales/${workflow}`} />
        <input type="hidden" name="next" value={`Continue ${config.title}`} />
        <WorkflowFormFields fields={config.fields} customers={lookups.customers} products={lookups.products} unpaidInvoices={lookups.unpaidInvoices} />
        <div className="mt-6">
          <button name="intent" value="Submitted" className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
            {workflow === "invoices" ? "Create invoice" : "Submit"}
          </button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold text-[var(--solva-blue-700)]">Download documents</p>
            <h2 className="mt-1 text-xl font-semibold">Available after this sales step</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Documents include tenant logo, Solva Trade branding, faint watermark, transaction details, line items, totals and approval notes.
            </p>
          </div>
          <a href="/reports" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Open centre</a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(workflowDocuments[workflow] ?? ["Sales Summary Report"]).map((document) => {
            const base = `/api/exports?module=Sales&process=${encodeURIComponent(document)}`;
            return (
              <article key={document} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-950">{document}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Ready in PDF, Excel and print format from this workspace.</p>
                <div className="mt-4">
                  <a href={`${base}&format=pdf`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white">
                    <FileText className="h-4 w-4" />
                    Generate
                  </a>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <a href={`${base}&format=excel`} className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-[var(--solva-blue-700)]">Excel</a>
                    <a href={`${base}&format=print`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
