import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildDocumentPreview,
  findSettingsSection,
  industryProfiles,
  settingsSections,
} from "@/lib/configuration";

export function generateStaticParams() {
  return settingsSections.map((section) => ({ section: section.slug }));
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = findSettingsSection(slug);
  if (!section) notFound();

  const documentPreview = buildDocumentPreview({
    prefix: "INV",
    branchCode: "NRB",
    year: 2026,
    number: 1,
  });

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/settings" className="text-sm font-semibold text-emerald-700">
            Settings
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">{section.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{section.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
            Export CSV
          </button>
          <button className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
            Import template
          </button>
          <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
            Save changes
          </button>
        </div>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {section.metrics.map((metric) => (
          <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
          </article>
        ))}
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Audit logging</p>
          <p className="mt-2 text-xl font-semibold">Enabled</p>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={`Search ${section.title.toLowerCase()}`}
          />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="active">
            <option value="active">Active only</option>
            <option value="inactive">Inactive</option>
            <option value="all">All statuses</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Configuration fields</h2>
          <p className="mt-1 text-sm text-slate-600">
            Validated server actions will persist these values tenant-scoped and record audit events.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {section.fields.slice(0, 10).map((field) => (
              <label key={field} className="text-sm font-medium">
                {field}
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={field} />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" defaultChecked />
              Active
            </label>
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" />
              Default
            </label>
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" defaultChecked />
              Tenant scoped
            </label>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Import safety</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Validate every row before commit.</li>
              <li>Reject duplicate codes within the business.</li>
              <li>Show row-level errors in preview.</li>
              <li>Create audit events after successful import.</li>
            </ul>
          </section>

          {slug === "documents" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Number preview</h2>
              <p className="mt-3 rounded-md bg-slate-950 px-3 py-3 font-mono text-sm text-white">{documentPreview}</p>
              <p className="mt-3 text-sm text-slate-600">
                Real numbers are generated server-side with row locking and immutable sequence history.
              </p>
            </section>
          ) : null}

          {slug === "tax" ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">Tax disclaimer</h2>
              <p className="mt-2 text-sm text-amber-900">
                KRA PIN checks are format-only here. Direct KRA or eTIMS verification is not implemented in this phase.
              </p>
            </section>
          ) : null}

          {slug === "industry-profiles" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Feature flags</h2>
              <div className="mt-3 space-y-3">
                {Object.entries(industryProfiles).map(([key, profile]) => (
                  <details key={key} className="rounded-md border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">{profile.label}</summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.flags.map((flag) => (
                        <span key={flag} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                          {flag.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-4 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>Name</span>
          <span>Code or type</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {section.fields.slice(0, 6).map((field, index) => (
          <div key={field} className="grid grid-cols-4 gap-3 border-b border-slate-100 px-4 py-3 text-sm">
            <span className="font-medium">{field}</span>
            <span className="text-slate-600">{field.toLowerCase().replaceAll(" ", "_")}</span>
            <span className="text-emerald-700">{index < 2 ? "Configured" : "Ready"}</span>
            <button className="w-fit text-sm font-semibold text-emerald-700">Edit</button>
          </div>
        ))}
      </section>
    </div>
  );
}
