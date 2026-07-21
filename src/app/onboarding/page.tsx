import Image from "next/image";

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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-6xl">
        <div className="w-56 overflow-hidden rounded-lg bg-[var(--solva-navy-900)] p-2 shadow-sm">
          <Image
            src="/solva-trade-logo.png"
            alt="Solva Trade"
            width={460}
            height={229}
            priority
            className="h-auto w-full"
          />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase text-emerald-700">Workspace onboarding</p>
        <h1 className="mt-2 text-4xl font-semibold">Create your business workspace</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Save and resume setup while creating the Owner membership and active business context.
        </p>
        {params.error ? (
          <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {params.error}
          </p>
        ) : null}
        {params.message ? (
          <p className="mt-5 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
            {params.message}
          </p>
        ) : null}
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
          <form action="/api/onboarding/complete" method="post" className="rounded-lg border border-slate-200 bg-white p-5">
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
                ["Company logo URL or uploaded path", "logo_path"],
              ].map(([field, name]) => (
                <label key={field} className="text-sm font-medium">
                  {field}
                  <input name={name} required={name === "logo_path"} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
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
