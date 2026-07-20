import {
  goLiveChecks,
  importCentreTypes,
  industryTemplates,
  onboardingStages,
} from "@/lib/saas-platform-data";

const importSteps = [
  "Template download",
  "Column mapping",
  "Validation",
  "Preview",
  "Duplicate detection",
  "Row-level errors",
  "Commit",
  "Import summary",
  "Rollback foundation",
  "Audit history",
];

export default function ImportsPage() {
  return (
    <div className="pb-20">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Guided setup</p>
        <h1 className="mt-1 text-3xl font-semibold">Import Centre and Go-live Readiness</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Central import, onboarding, industry-template and go-live checklist foundation for real tenant setup without fake live transactions.
        </p>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Import Types</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {importCentreTypes.map((type) => (
              <span key={type} className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{type}</span>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Import Workflow</h2>
          <div className="mt-4 grid gap-2">
            {importSteps.map((step, index) => (
              <div key={step} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                {index + 1}. {step}
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Industry Templates</h2>
          <div className="mt-4 grid gap-2">
            {industryTemplates.map((template) => (
              <div key={template} className="rounded-md bg-slate-100 px-3 py-3 text-sm">{template}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Tenant Onboarding</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {onboardingStages.map((stage, index) => (
              <div key={stage} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{index + 1}. </span>{stage}
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Go-live Checklist</h2>
          <div className="mt-4 grid gap-2">
            {goLiveChecks.map((check) => (
              <div key={check} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span>{check}</span>
                <span className="text-slate-500">Pending</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
