import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { distributionReports } from "@/lib/distribution";
import { closureChecks, dispatchChecks, mobileActions, planningViews } from "@/lib/distribution-data";

const workflows: Record<string, { title: string; description: string; fields: string[]; sideTitle: string; sideItems: string[]; controls: string }> = {
  planning: {
    title: "Delivery Planning Board",
    description: "Group approved and ready orders into runs by delivery date, branch, route, customer, warehouse, priority, payment type and stock availability.",
    fields: ["Delivery date", "Branch", "Route", "Customer", "Warehouse", "Priority", "Payment type", "Delivery status", "Vehicle", "Driver", "Stop sequence"],
    sideTitle: "Planning views",
    sideItems: planningViews,
    controls: "Orders can be split between runs or merged into one compatible customer stop. Map routing is intentionally deferred.",
  },
  runs: {
    title: "Delivery Runs",
    description: "Create delivery runs with route, vehicle, driver, warehouses, capacity status, approval status, odometer, fuel, totals and closure state.",
    fields: ["Run number", "Run type", "Route", "Delivery date", "Vehicle", "Primary driver", "Assistant driver", "Dispatch warehouse", "Vehicle stock warehouse", "Return warehouse", "Priority"],
    sideTitle: "Run statuses",
    sideItems: ["Draft", "Pending Approval", "Approved", "Loading", "Ready for Dispatch", "Dispatched", "In Progress", "Returned to Depot", "Pending Reconciliation", "Closed"],
    controls: "Closed runs are protected by the database and require a reopening reason before any controlled changes.",
  },
  loading: {
    title: "Loading Sheets",
    description: "Generate loading sheets from orders, invoices, pick lists, route-sale planned stock or authorised manual additions.",
    fields: ["Loading sheet number", "Vehicle", "Driver", "Product", "Batch", "Serial number", "Ordered quantity", "Picked quantity", "Loaded quantity", "Difference reason", "Stock location"],
    sideTitle: "Loading controls",
    sideItems: ["Barcode scanning", "Pack and base units", "FEFO allocation", "Batch tracking", "Serial tracking", "Partial loading", "Substitutions"],
    controls: "Expired, quarantined and recalled batches are blocked from FEFO loading. Loading more than available stock requires configured approval.",
  },
  dispatch: {
    title: "Dispatch Confirmation",
    description: "Confirm run, vehicle, driver, loading, documents, odometer and fuel before posting vehicle-stock movements.",
    fields: ["Run", "Vehicle", "Driver", "Opening odometer", "Fuel issued", "Loading sheet", "Dispatch time", "Override reason"],
    sideTitle: "Dispatch checks",
    sideItems: dispatchChecks,
    controls: "Dispatch posts immutable transfer-out and transfer-in stock movements for warehouse-to-vehicle stock.",
  },
  mobile: {
    title: "Driver Mobile Workspace",
    description: "A phone-first workspace for assigned delivery staff to complete stops, collect payments, capture proof and record returns.",
    fields: ["Current stop", "Customer", "Phone", "Address", "Delivered quantity", "Rejected quantity", "Payment received", "Recipient name", "GPS permission", "Notes"],
    sideTitle: "Large actions",
    sideItems: mobileActions,
    controls: "Assigned staff see only their runs, stops, loading sheets, collections and reconciliation tasks through RLS assignment policies.",
  },
  "route-sales": {
    title: "Route Sales",
    description: "Load planned vehicle stock, visit customers, create direct sales or invoices, collect payment, record crates and reconcile unsold stock.",
    fields: ["Route", "Vehicle stock item", "Customer", "Price level", "Quantity sold", "Payment method", "Credit check", "Crates issued", "Crates returned"],
    sideTitle: "Route sale controls",
    sideItems: ["Customer pricing", "Credit checks", "Cash customer support", "Duplicate retry prevention", "Vehicle stock-out", "Receipt generation"],
    controls: "Route sales reuse the customer-payment foundation; this phase does not claim full offline synchronisation.",
  },
  collections: {
    title: "Delivery Collections",
    description: "Record cash, M-Pesa, bank transfer, cheque, card, deposits, credit sales, partial payments and unallocated payments.",
    fields: ["Run", "Stop", "Customer", "Invoice", "Amount expected", "Amount received", "Payment method", "Reference", "Payer name", "Payer phone"],
    sideTitle: "COD controls",
    sideItems: ["Amount due", "Deposit paid", "Credit notes", "Customer credit", "Final expected", "Balance remaining"],
    controls: "Short payment requires credit approval, a passing credit check or an authorised override with a reason.",
  },
  reconciliation: {
    title: "Route Reconciliation",
    description: "Compare expected collections, submitted cash, verified M-Pesa, cheques, customer credit, expenses, refunds, stock and packaging variances.",
    fields: ["Reconciliation number", "Driver", "Cash expected", "Cash submitted", "M-Pesa expected", "M-Pesa verified", "Route expenses", "Variance", "Reason"],
    sideTitle: "Close checks",
    sideItems: closureChecks,
    controls: "Vehicle-stock and route-collection reconciliations are separate records so stock and cash variances can be approved independently.",
  },
  packaging: {
    title: "Crates and Empties",
    description: "Track crates, empty bottles and other returnable packaging by customer, vehicle and delivery run.",
    fields: ["Packaging item", "Customer", "Vehicle", "Transaction type", "Quantity", "Deposit amount", "Replacement charge", "Reference", "Notes"],
    sideTitle: "Packaging transactions",
    sideItems: ["Loaded to vehicle", "Issued to customer", "Returned by customer", "Collected from customer", "Returned to warehouse", "Lost", "Damaged"],
    controls: "Packaging uses immutable ledger records and balance summaries for customer and vehicle accounts.",
  },
  exceptions: {
    title: "Delivery Exceptions",
    description: "Capture and resolve stock shortages, damaged goods, customer rejection, payment shortfalls, proof gaps, packaging variances and vehicle issues.",
    fields: ["Run", "Stop", "Exception type", "Severity", "Description", "Attachment", "Assigned user", "Resolution status", "Resolution notes"],
    sideTitle: "Severity",
    sideItems: ["Information", "Warning", "High", "Critical"],
    controls: "Runs can close only when exceptions are resolved, accepted or overridden by an authorised user.",
  },
  timeline: {
    title: "Delivery Timeline",
    description: "Filter events by run, route, vehicle, driver, customer, date and status from planning through route close.",
    fields: ["Run", "Route", "Vehicle", "Driver", "Customer", "Date", "Status", "Event type"],
    sideTitle: "Timeline events",
    sideItems: ["Run created", "Loading verified", "Vehicle dispatched", "Stop arrival", "Delivery completed", "Payment collected", "Vehicle returned", "Run closed"],
    controls: "Timeline events are tenant-scoped records fed by dispatch, proof, collection, return, reconciliation and closure actions.",
  },
  reports: {
    title: "Distribution Reports",
    description: "Run route, driver, vehicle, delivery, loading, collections, stock, return, proof and packaging reports.",
    fields: ["Report", "Date range", "Branch", "Route", "Vehicle", "Driver", "Customer", "Product", "Status", "Export format"],
    sideTitle: "Reports",
    sideItems: distributionReports.slice(0, 12),
    controls: `${distributionReports.length} reports are registered for CSV, PDF, print and Excel-compatible export workflows.`,
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function DistributionWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Distribution workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Distribution" />
          <input type="hidden" name="process" value={config.title} />
          <input type="hidden" name="returnTo" value={`/distribution/${workflow}`} />
          <input type="hidden" name="next" value={`Continue ${config.title}`} />
          <WorkflowFormFields fields={config.fields} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button name="intent" value="Draft saved" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Save draft</button>
            <button name="intent" value="Checks previewed" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold">Preview checks</button>
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
