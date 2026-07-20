import { completeOnboardingAction } from "./actions";

const steps = [
  "Welcome",
  "Business details",
  "Business activity",
  "Operating structure",
  "Financial setup",
  "Branding",
  "Finish",
];

const activities = [
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Supplier",
  "Fish business",
  "Hardware",
  "Restaurant",
  "Pharmacy",
  "Manufacturing",
  "Service business",
  "General trading",
  "Other",
];

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase text-emerald-700">Solva Trade onboarding</p>
        <h1 className="mt-2 text-4xl font-semibold">Create your business workspace</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Save and resume setup while creating the Owner membership and active business context.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-50 text-sm font-semibold text-emerald-800">
                  {index + 1}
                </span>
                <span className="text-sm font-medium">{step}</span>
              </div>
            ))}
          </aside>
          <form action={completeOnboardingAction} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold">Business details and setup</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Legal business name", "legal_name"],
                ["Trading name", "trading_name"],
                ["Phone", "phone"],
                ["Email", "email"],
                ["Physical location", "physical_address"],
                ["County", "county"],
                ["KRA PIN", "kra_pin"],
                ["Primary brand colour", "primary_brand_color"],
              ].map(([field, name]) => (
                <label key={field} className="text-sm font-medium">
                  {field}
                  <input name={name} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
                </label>
              ))}
              <label className="text-sm font-medium">
                Country
                <input name="country" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="Kenya" />
              </label>
              <label className="text-sm font-medium">
                Default currency
                <input name="default_currency" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="KES" />
              </label>
              <label className="text-sm font-medium">
                Financial year start
                <select name="financial_year_start_month" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="1">
                  <option value="1">January</option>
                  <option value="7">July</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Stock costing method
                <select name="stock_costing_method" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="weighted_average">
                  <option value="weighted_average">Weighted average cost</option>
                  <option value="fifo">FIFO</option>
                </select>
              </label>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold">Business activity</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activities.map((activity) => (
                  <label key={activity} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" />
                    {activity}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {["One location", "Multiple branches", "Warehouses", "Delivery vehicles", "Sales routes", "Credit customers"].map((flag) => (
                <label key={flag} className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
                  <input type="checkbox" />
                  {flag}
                </label>
              ))}
            </div>
            <button className="mt-6 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
              Save and finish onboarding
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
