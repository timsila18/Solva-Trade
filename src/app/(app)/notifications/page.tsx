import Link from "next/link";
import { completeProcessAction } from "@/app/(app)/actions";

const notifications = [
  { title: "Business setup incomplete", module: "System", priority: "normal", state: "unread", action: "Open settings", href: "/settings/business-profile" },
  { title: "Supplier bill approval pending", module: "Approvals", priority: "high", state: "unread", action: "Review approval", href: "/purchases/supplier-bills" },
  { title: "Failed posting event", module: "Accounting", priority: "urgent", state: "unread", action: "Open diagnostics", href: "/accounting/journals" },
  { title: "Low stock alert", module: "Inventory", priority: "high", state: "pinned", action: "Review stock", href: "/inventory/reorder" },
  { title: "Customer payment overdue", module: "Sales", priority: "high", state: "unread", action: "Follow up", href: "/customers" },
  { title: "Purchase order expected today", module: "Purchasing", priority: "normal", state: "read", action: "Open PO", href: "/purchases/purchase-orders" },
  { title: "Bank reconciliation due", module: "Treasury", priority: "normal", state: "read", action: "Reconcile", href: "/cash-bank/reconciliation" },
  { title: "VAT filing due soon", module: "Tax", priority: "urgent", state: "pinned", action: "Prepare VAT", href: "/tax" },
  { title: "Budget variance watch", module: "Budget", priority: "normal", state: "muted", action: "Open budget", href: "/financials/budgets" },
  { title: "Executive pack ready", module: "Reports", priority: "normal", state: "archived", action: "Open report", href: "/reports" },
  { title: "Role permission changed", module: "Security", priority: "high", state: "unread", action: "Review audit", href: "/settings/data-security" },
];

const filters = ["All", "Unread", "Pinned", "Archived", "Muted", "High priority"];

export default function NotificationsPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Notification centre</p>
          <h1 className="mt-1 text-3xl font-semibold">Notifications</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Centralised operating notifications for system, approvals, accounting, inventory, sales, purchasing, treasury, tax, budget, reports and security.
          </p>
        </div>
        <form action={completeProcessAction}>
          <input type="hidden" name="module" value="Notifications" />
          <input type="hidden" name="process" value="Notification centre" />
          <input type="hidden" name="intent" value="Notifications marked as read" />
          <input type="hidden" name="returnTo" value="/notifications" />
          <input type="hidden" name="next" value="Back to notifications" />
          <button className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">Mark all as read</button>
        </form>
      </div>

      <section className="mt-6 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter}
            href={`/notifications?filter=${encodeURIComponent(filter.toLowerCase().replaceAll(" ", "-"))}`}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            {filter}
          </Link>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {notifications.map((notification) => (
          <div key={`${notification.module}-${notification.title}`} className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 md:grid-cols-[1fr_0.5fr_0.4fr_0.4fr_0.5fr] md:items-center">
            <div>
              <h2 className="font-semibold">{notification.title}</h2>
              <p className="text-sm text-slate-600">Read, unread, pin, archive and mute states are persisted by notification records.</p>
            </div>
            <span className="text-sm text-slate-600">{notification.module}</span>
            <span className="text-sm font-semibold text-slate-700">{notification.priority}</span>
            <span className="text-sm text-slate-600">{notification.state}</span>
            <Link href={notification.href} className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notification.action}</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
