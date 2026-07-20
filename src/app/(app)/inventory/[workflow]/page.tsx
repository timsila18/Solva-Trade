import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";

const workflows: Record<string, { title: string; description: string; fields: string[] }> = {
  "opening-stock": {
    title: "Opening Stock",
    description: "Enter individual or bulk opening stock, preview validation errors, save drafts and post immutable opening-stock movements.",
    fields: ["Product", "Variant", "Branch", "Warehouse", "Quantity", "Unit", "Unit cost", "Batch", "Expiry date", "Serial number", "Opening date"],
  },
  transfers: {
    title: "Stock Transfers",
    description: "Create branch, warehouse, shop floor, vehicle, transit, returns and damaged-store transfers using document-number sequences.",
    fields: ["Transfer number", "From branch", "From warehouse", "To branch", "To warehouse", "Expected arrival", "Status", "Discrepancy reason"],
  },
  adjustments: {
    title: "Stock Adjustments",
    description: "Control damaged, expired, lost, found, internal-use, promotional and data-correction adjustments with approval rules.",
    fields: ["Adjustment number", "Branch", "Warehouse", "Reason", "Current quantity", "Adjustment quantity", "New quantity", "Value effect"],
  },
  counts: {
    title: "Stock Counts",
    description: "Run full, cycle, category, warehouse, selected product, batch, blind and non-blind stock counts.",
    fields: ["Count number", "Count type", "Snapshot", "Assigned users", "Expected quantity", "Counted quantity", "Variance", "Variance value"],
  },
  reorder: {
    title: "Reorder Centre",
    description: "Calculate healthy, approaching reorder, reorder now, out-of-stock and overstocked states by product, branch and warehouse.",
    fields: ["Product", "Available quantity", "Reorder point", "Recommended quantity", "Safety stock", "Lead time", "Maximum stock"],
  },
};

export function generateStaticParams() {
  return Object.keys(workflows).map((workflow) => ({ workflow }));
}

export default async function InventoryWorkflowPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  const config = workflows[workflow];
  if (!config) notFound();

  return (
    <div className="pb-20">
      <p className="text-sm font-semibold text-emerald-700">Inventory workflow</p>
      <h1 className="mt-1 text-3xl font-semibold">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{config.description}</p>

      <form action={completeProcessAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <input type="hidden" name="module" value="Inventory" />
        <input type="hidden" name="process" value={config.title} />
        <input type="hidden" name="returnTo" value={`/inventory/${workflow}`} />
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
          <button name="intent" value="Submitted for posting" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Submit for posting</button>
        </div>
      </form>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Posting controls</h2>
        <p className="mt-2 text-sm text-slate-600">
          Posted inventory actions create immutable stock movements, update balances transactionally, create audit records and respect branch access, approvals, closed periods and negative-stock rules.
        </p>
      </section>
    </div>
  );
}
