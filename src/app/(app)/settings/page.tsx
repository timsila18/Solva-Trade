import Link from "next/link";
import { settingsSections } from "@/lib/configuration";

export default function SettingsPage() {
  const grouped = settingsSections.reduce<Record<string, typeof settingsSections>>((groups, section) => {
    groups[section.category] = [...(groups[section.category] ?? []), section];
    return groups;
  }, {});

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Owner settings</p>
          <h1 className="mt-1 text-3xl font-semibold">Business Settings Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Configure how the business operates before products, sales, purchases, inventory and accounting are introduced.
          </p>
        </div>
        <Link href="/settings/industry-profiles" className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">
          Apply setup preset
        </Link>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        {[
          ["Profile completion", "78%"],
          ["Active branches", "1"],
          ["Stock locations", "1"],
          ["Setup alerts", "4"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold text-amber-950">Tax setup note</h2>
        <p className="mt-1 text-sm text-amber-900">
          Solva Trade supports record keeping and tax-report preparation. It does not replace professional tax advice or claim direct KRA verification without an enabled integration.
        </p>
      </section>

      <div className="mt-6 space-y-8">
        {Object.entries(grouped).map(([category, sections]) => (
          <section key={category}>
            <h2 className="text-lg font-semibold">{category}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <Link
                  href={`/settings/${section.slug}`}
                  key={section.slug}
                  className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{section.title}</h3>
                    {section.advanced ? <span className="text-xs text-slate-500">Advanced</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{section.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {section.metrics.map((metric) => (
                      <span key={metric.label} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {metric.label}: {metric.value}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
