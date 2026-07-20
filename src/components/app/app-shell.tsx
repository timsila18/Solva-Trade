import Link from "next/link";
import { navigationItems } from "@/lib/navigation";
import { canPerformAction } from "@/lib/permissions";
import { demoBranches, demoBusinesses, demoMemberships } from "@/lib/mock-data";

export function AppShell({ children }: { children: React.ReactNode }) {
  const business = demoBusinesses[0];
  const branch = demoBranches[0];
  const membership = demoMemberships[0];
  const nav = navigationItems.filter(
    (item) => !item.permission || canPerformAction(membership, item.permission),
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <Link href="/dashboard" className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Solva Trade
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Run Your Business Smarter.</h1>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <span>{item.label}</span>
              {item.status === "next_phase" ? (
                <span className="text-[10px] uppercase text-slate-400">Soon</span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Active business</p>
              <button className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold shadow-sm">
                {business.tradingName}
                <span className="ml-2 text-xs font-normal text-emerald-700">Owner</span>
              </button>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-slate-500">Active branch</p>
              <button className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold shadow-sm">
                {branch.name}
                <span className="ml-2 text-xs font-normal text-slate-500">{branch.code}</span>
              </button>
            </div>
            <div className="hidden flex-1 justify-center md:flex">
              <div className="w-full max-w-xl rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                Search customers, invoices, stock, reports
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/notifications" className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                Notifications
              </Link>
              <Link href="/settings" className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white">
                Profile
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
        {nav.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="px-2 py-3 text-center text-xs font-medium">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
