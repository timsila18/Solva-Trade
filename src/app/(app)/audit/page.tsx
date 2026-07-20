const actions = [
  "business.created",
  "business.updated",
  "user.invited",
  "invitation.accepted",
  "role.changed",
  "permissions.changed",
  "active_business.switched",
];

export default function AuditPage() {
  return (
    <div className="pb-20">
      <h1 className="text-3xl font-semibold">Audit Trail</h1>
      <p className="mt-2 text-slate-600">Immutable foundational activity. Owners can view records but not alter them.</p>
      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {actions.map((action) => (
          <div key={action} className="grid gap-2 border-b border-slate-100 px-5 py-4 md:grid-cols-4">
            <span className="font-medium">{action}</span>
            <span className="text-sm text-slate-600">Foundation</span>
            <span className="text-sm text-slate-600">Current user</span>
            <span className="text-sm text-slate-600">Captured by audit_logs</span>
          </div>
        ))}
      </section>
    </div>
  );
}
