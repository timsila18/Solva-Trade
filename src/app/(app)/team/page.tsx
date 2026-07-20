import { UserPlus, Users } from "lucide-react";
import { createTeamUserAction } from "@/app/(app)/team/actions";
import { MetricCard, PageHero } from "@/components/ui/premium";
import { permissionCatalog, staffTemplates } from "@/lib/permissions";
import { configurationStats } from "@/lib/mock-data";

export default function TeamPage() {
  return (
    <div className="pb-24">
      <PageHero
        eyebrow="Team"
        title="Create users and control what each person can do."
        description="Owners can add staff, managers or another owner, then keep permissions simple with role templates."
        primaryAction={{ label: "Create User", href: "#create-user", icon: UserPlus }}
        secondaryAction={{ label: "Review Permissions", href: "#permissions" }}
        insight="Start with a role. Add detailed permissions only when someone needs access to a specific workflow."
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Active users" value={configurationStats.activeUsers.toString()} story="Users with access to this business." />
        <MetricCard label="Default role templates" value={Object.keys(staffTemplates).length.toString()} story="Fast setup for common SME roles." />
        <MetricCard label="Permission areas" value={Object.keys(permissionCatalog).length.toString()} story="Advanced controls stay available when needed." />
      </section>

      <section id="create-user" className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={createTeamUserAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-[var(--solva-blue-700)]">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Create a new user</h2>
              <p className="mt-1 text-sm text-slate-600">The user can sign in immediately with the email and password you set.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Full name
              <input name="full_name" required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Example: Mary Wanjiku" />
            </label>
            <label className="text-sm font-medium">
              Email address
              <input name="email" required type="email" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="mary@example.com" />
            </label>
            <label className="text-sm font-medium">
              Temporary password
              <input name="password" required type="password" minLength={8} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="At least 8 characters" />
            </label>
            <label className="text-sm font-medium">
              Role
              <select name="role" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="staff">
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Work template
              <select name="staff_template" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue="salesperson">
                {Object.keys(staffTemplates).map((template) => (
                  <option key={template} value={template}>{template.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          </div>

          <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-5 py-3 text-sm font-semibold text-white shadow-sm">
            <UserPlus className="h-4 w-4" />
            Create user
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">How access works</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Staff see the business workflows their role allows. Owners can adjust detailed permissions later.
            </p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Security note</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use a temporary password, then ask the user to change it after their first sign-in.
            </p>
          </section>
        </aside>
      </section>

      <section id="permissions" className="mt-6 grid gap-4 lg:grid-cols-2">
        {Object.entries(permissionCatalog).map(([key, category]) => (
          <article key={key} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{category.label}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {category.permissions.slice(0, 10).map((permission) => (
                <label key={permission.key} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
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
