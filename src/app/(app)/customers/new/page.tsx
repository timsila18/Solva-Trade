import Link from "next/link";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import { PageHero } from "@/components/ui/premium";

const simpleFields = ["Customer name", "Phone number", "Town or area", "Delivery route"];
const advancedFields = ["KRA PIN", "Email", "Opening balance", "Credit limit"];

export default function NewCustomerPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="New Customer"
        title="Add only what you know now. Improve the record later."
        description="A customer can start with a name and phone number. Payment terms, tax details and routes can be added when they matter."
        primaryAction={{ label: "Save Customer", href: "/customers", icon: Save }}
        secondaryAction={{ label: "Back to Customers", href: "/customers" }}
        insight="I will suggest payment terms, routes and prices as the customer starts buying from you."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-emerald-50 text-emerald-800">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Customer basics</h2>
              <p className="mt-1 text-sm text-slate-600">Name and phone are enough to begin.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {simpleFields.map((field, index) => (
              <label key={field} className="text-sm font-medium">
                {field}
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder={index === 0 ? "Example: Mary Wanjiku Shop" : field}
                />
              </label>
            ))}
          </div>

          <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">More details</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {advancedFields.map((field) => (
                <label key={field} className="text-sm font-medium">
                  {field}
                  <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" placeholder={field} />
                </label>
              ))}
              <label className="text-sm font-medium">
                Payment agreement
                <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue="Cash">
                  {["Cash", "Pay in 7 days", "Pay in 14 days", "Pay in 30 days"].map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Price group
                <select className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue="Standard">
                  {["Standard", "Wholesale", "Retail", "Special customer"].map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              <Save className="h-4 w-4" />
              Save customer
            </button>
            <Link href="/customers" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Smart defaults</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Today&apos;s branch, default route, standard price group and cash terms are preselected so setup stays quick.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Why this matters</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A clean customer record makes sales faster, delivery easier and payment follow-up clearer.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
