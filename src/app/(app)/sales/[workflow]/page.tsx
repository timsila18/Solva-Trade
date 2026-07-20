import { notFound } from "next/navigation";

const workflows: Record<string, { title: string; description: string; fields: string[] }> = {
  quotations: {
    title: "Quotations",
    description: "Prepare customer quotations and convert accepted offers into sales orders.",
    fields: ["Quotation number", "Customer", "Date", "Valid until", "Product", "Quantity", "Price", "Discount", "Tax", "Total"],
  },
  orders: {
    title: "Sales Orders",
    description: "Approve customer demand and expose ready orders to delivery planning.",
    fields: ["Sales order number", "Customer", "Route", "Delivery date", "Payment status", "Product", "Ordered quantity", "Delivery priority"],
  },
  invoices: {
    title: "Invoices",
    description: "Issue invoices and track payment and delivery status.",
    fields: ["Invoice number", "Customer", "Sales order", "Invoice date", "Due date", "Subtotal", "Tax", "Total", "Balance due"],
  },
  payments: {
    title: "Customer Payments",
    description: "Record customer payments and allocations that delivery collections can reuse.",
    fields: ["Payment number", "Customer", "Invoice", "Payment method", "Amount", "Reference", "Payer name", "Receipt status"],
  },
  returns: {
    title: "Customer Returns",
    description: "Create return and credit workflows for rejected or returned delivery items.",
    fields: ["Return number", "Customer", "Invoice", "Product", "Returned quantity", "Reason", "Disposition", "Credit required"],
  },
  "debtor-ageing": {
    title: "Debtor Ageing",
    description: "Monitor customer balances by due-date bucket.",
    fields: ["As-of date", "Customer", "Route", "Branch", "Current", "1-30", "31-60", "61-90", "Over 90"],
  },
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

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Sales workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {config.fields.map((field) => (
            <label key={field} className="text-sm font-medium">
              {field}
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={field} />
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save draft</button>
          <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview validation</button>
          <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Submit</button>
        </div>
      </section>
    </div>
  );
}
