import { platformRoles } from "@/lib/saas-platform-data";

const platformMetrics = [
  "Total businesses",
  "Active businesses",
  "Trial businesses",
  "Paying businesses",
  "Suspended businesses",
  "Cancelled businesses",
  "Businesses pending onboarding",
  "Total active users",
  "New sign-ups",
  "Subscription distribution",
  "Monthly recurring revenue foundation",
  "Failed payments",
  "Trial conversions",
  "Subscription cancellations",
  "Usage by plan",
  "Storage usage",
  "Queue health",
  "Integration failures",
  "Application errors",
  "Security alerts",
  "Support cases",
  "System uptime",
  "Database status",
  "Recent deployments",
];

const adminWorkflows = [
  ["Platform dashboard", "Aggregated metadata without tenant transaction detail."],
  ["Plan management", "Commercial plans, entitlements, overage rules and effective dates."],
  ["Billing operations", "Failed payments, manual verification, invoices and adjustments."],
  ["Support access", "Scoped, time-bound support access with reason and audit."],
  ["Security review", "Security events, admin access, MFA status and suspicious activity."],
  ["Operational monitoring", "Queues, jobs, integrations, errors, backups and deployment status."],
];

export default function PlatformAdminPage() {
  return (
    <div className="pb-20">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Internal only</p>
        <h1 className="mt-1 text-3xl font-semibold">Platform Administration</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Separate platform workspace for authorised Solva Trade administrators. Tenant Owners and Managers are not platform administrators.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {platformMetrics.map((metric) => (
          <article key={metric} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{metric}</p>
            <h2 className="mt-3 text-xl font-semibold">No live aggregate yet</h2>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Platform Roles</h2>
          <div className="mt-4 grid gap-2">
            {platformRoles.map(([role, body]) => (
              <div key={role} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{role}</span>
                <p className="mt-1 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Workflows</h2>
          <div className="mt-4 grid gap-2">
            {adminWorkflows.map(([title, body]) => (
              <div key={title} className="rounded-md bg-slate-100 px-3 py-3 text-sm">
                <span className="font-semibold">{title}</span>
                <p className="mt-1 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
