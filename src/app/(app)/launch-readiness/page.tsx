import {
  launchChecklist,
  launchReadinessReport,
  pilotChecklist,
  productionEnvReference,
} from "@/lib/saas-platform-data";

export default function LaunchReadinessPage() {
  return (
    <div className="pb-20">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Commercial readiness</p>
        <h1 className="mt-1 text-3xl font-semibold">Launch Readiness Report</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Final readiness classification across security, tenant isolation, billing, data integrity, performance, backups, monitoring, support, documentation and legal foundations.
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Final classification</p>
        <h2 className="mt-3 text-3xl font-semibold">{launchReadinessReport.classification}</h2>
        <p className="mt-3 text-sm text-slate-600">
          Classification remains conservative because managed backup drills and formal legal/compliance review require manual infrastructure and external professional completion.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {launchReadinessReport.areas.map((area) => (
          <article key={area.area} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{area.area}</h2>
              <span className={area.criticalBlocker ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-emerald-700"}>
                {area.score}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{area.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Pilot Launch Checklist</h2>
          <div className="mt-4 grid gap-2">
            {pilotChecklist.map((item) => (
              <div key={item} className="rounded-md border border-slate-200 px-3 py-3 text-sm">{item}</div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Production Launch Checklist</h2>
          <div className="mt-4 grid gap-2">
            {launchChecklist.map((item) => (
              <div key={item} className="rounded-md border border-slate-200 px-3 py-3 text-sm">{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Environment Variables</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          {productionEnvReference.map(([name, purpose, env, scope, example]) => (
            <div key={name} className="grid gap-2 border-b border-slate-200 px-3 py-3 text-sm last:border-b-0 md:grid-cols-[0.6fr_1fr_0.6fr_0.4fr_0.7fr]">
              <span className="font-semibold">{name}</span>
              <span>{purpose}</span>
              <span className="text-slate-600">{env}</span>
              <span className="text-slate-600">{scope}</span>
              <span className="text-slate-600">{example}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
