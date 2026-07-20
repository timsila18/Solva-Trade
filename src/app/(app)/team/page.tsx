import { permissionCatalog, staffTemplates } from "@/lib/permissions";

export default function TeamPage() {
  return (
    <div className="pb-20">
      <h1 className="text-3xl font-semibold">Team and permissions</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Owner-only foundation for invitations, role assignment, staff templates and permission overrides.
      </p>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Invite user</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Email address" />
          <select className="rounded-md border border-slate-300 px-3 py-2" defaultValue="staff">
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2" defaultValue="salesperson">
            {Object.keys(staffTemplates).map((template) => (
              <option key={template} value={template}>{template}</option>
            ))}
          </select>
        </div>
        <button className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Send invitation</button>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {Object.entries(permissionCatalog).map(([key, category]) => (
          <article key={key} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{category.label}</h2>
            <div className="mt-4 space-y-2">
              {category.permissions.map((permission) => (
                <label key={permission.key} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" />
                  {permission.label}
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
