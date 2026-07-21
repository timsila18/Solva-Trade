import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  CircleHelp,
  LogIn,
  LogOut,
  PackagePlus,
  ReceiptText,
  Settings,
  UserPlus,
} from "lucide-react";
import { QuickCommand } from "@/components/app/quick-command";
import { navigationItems } from "@/lib/navigation";
import { canPerformAction } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CoreRole, Membership } from "@/lib/types";

const priorityNav = [
  "Dashboard",
  "Sales",
  "Customers",
  "Inventory",
  "Cash & Bank",
  "Reports",
  "Support",
];

const quickCreate = [
  { label: "New Sale", href: "/sales/invoices", icon: ReceiptText },
  { label: "New Customer", href: "/customers/new", icon: UserPlus },
  { label: "Receive Stock", href: "/purchases/goods-received", icon: PackagePlus },
];

function roleName(role: CoreRole | string | null | undefined) {
  if (role === "owner") return "Business Owner";
  if (role === "manager") return "Manager";
  if (role === "staff") return "Staff";
  return "User";
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const activeBusinessId = typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null;
  const metadataRole = typeof user?.app_metadata?.business_role === "string" ? user.app_metadata.business_role : "owner";
  const metadataBusinessName =
    typeof user?.app_metadata?.business_name === "string" ? user.app_metadata.business_name : "your business";
  const metadataBusinessShortName =
    typeof user?.app_metadata?.business_short_name === "string" ? user.app_metadata.business_short_name : metadataBusinessName;
  const userName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user?.email?.split("@")[0] ?? "Guest user";

  let business = {
    id: activeBusinessId ?? "local-business",
    tradingName: metadataBusinessName,
    legalName: metadataBusinessName,
  };
  let branch = { name: "Main workspace", code: "HQ" };
  let membership: Membership = {
    userId: user?.id ?? "guest-user",
    businessId: business.id,
    role: metadataRole === "manager" || metadataRole === "staff" ? metadataRole : "owner",
    permissions: [],
    active: Boolean(user),
    branchAccessMode: "all",
  };

  if (user) {
    const { data: membershipData } = await supabase
      .from("business_memberships")
      .select("business_id, role, permission_overrides, branch_access_mode, default_branch_id, branch_ids")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (membershipData?.business_id) {
      membership = {
        userId: user.id,
        businessId: membershipData.business_id,
        role: membershipData.role,
        permissions: Array.isArray(membershipData.permission_overrides) ? membershipData.permission_overrides : [],
        active: true,
        branchAccessMode: membershipData.branch_access_mode ?? "all",
        defaultBranchId: membershipData.default_branch_id ?? undefined,
        branchIds: membershipData.branch_ids ?? [],
      };

      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, trading_name, legal_name")
        .eq("id", membershipData.business_id)
        .maybeSingle();
      if (businessData) {
        business = {
          id: businessData.id,
          tradingName: businessData.trading_name,
          legalName: businessData.legal_name,
        };
      }

      const { data: branchData } = await supabase
        .from("branches")
        .select("branch_name, branch_code")
        .eq("business_id", membershipData.business_id)
        .eq("active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (branchData) branch = { name: branchData.branch_name, code: branchData.branch_code };
    }
  }

  const nav = navigationItems.filter(
    (item) => !item.permission || canPerformAction(membership, item.permission),
  );
  const mainNav = nav.filter((item) => priorityNav.includes(item.label));
  const moreNav = nav.filter((item) => !priorityNav.includes(item.label));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfdf5_0,#f8fafc_32rem)] text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-[var(--solva-navy-900)] text-white shadow-2xl lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/dashboard" className="block rounded-lg px-2 py-2">
            <span className="block overflow-hidden rounded-md border border-cyan-300/20 bg-[#03111f] p-2 shadow-lg shadow-blue-950/30">
              <Image
                src="/solva-trade-logo.png"
                alt="Solva Trade"
                width={460}
                height={229}
                priority
                className="h-auto w-full"
              />
            </span>
            <h1 className="mt-3 text-xl font-semibold tracking-normal">Run. Grow. Lead.</h1>
          </Link>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-5 pr-2">
          <nav className="space-y-1 pr-2">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-blue-50/85 transition hover:bg-white/10 hover:text-white"
              >
                <span>{item.label}</span>
                {item.status === "next_phase" ? (
                  <span className="text-[10px] uppercase text-cyan-200/70">Soon</span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="px-3 text-xs font-semibold uppercase text-cyan-200/70">More tools</p>
            <div className="mt-2 grid gap-1 pr-2">
              {moreNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-blue-50/70 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-xl">
          <div className="grid gap-3 xl:grid-cols-[minmax(220px,320px)_minmax(260px,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard" className="relative h-10 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--solva-navy-900)] lg:hidden">
                <Image
                  src="/solva-trade-logo.png"
                  alt="Solva Trade"
                  fill
                  sizes="80px"
                  className="object-cover object-left"
                />
              </Link>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {user ? `Logged in as ${userName} ${roleName(membership.role)} ${metadataBusinessShortName}` : "You are working in"}
                </p>
                <p className="text-sm font-semibold text-slate-950">
                  {business.tradingName}
                  <span className="ml-2 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    {roleName(membership.role)}
                  </span>
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <QuickCommand />
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              <span className="hidden min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 sm:inline-flex">
                {branch.name} · {branch.code}
              </span>
              {quickCreate.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-[var(--solva-blue-700)]"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{action.label}</span>
                  </Link>
                );
              })}
              <Link href="/support" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
                <CircleHelp className="h-4 w-4" />
              </Link>
              <Link href="/notifications" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
                <Bell className="h-4 w-4" />
              </Link>
              {user ? (
                <form action="/api/auth/sign-out" method="post" className="shrink-0">
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm" aria-label="Logout">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/sign-in" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link href="/create-account" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-[var(--solva-blue-700)] px-3 text-sm font-semibold text-white shadow-sm">
                    Sign up
                  </Link>
                </>
              )}
              <Link href="/settings" className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-950 text-white shadow-sm">
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {mainNav.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="px-2 py-3 text-center text-xs font-semibold text-slate-700">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
