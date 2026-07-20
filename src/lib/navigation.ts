import type { NavigationItem } from "./types";

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", status: "ready" },
  { label: "Sales", href: "/sales", permission: "sales.view", status: "ready" },
  { label: "Purchases", href: "/purchases", permission: "purchases.view", status: "ready" },
  { label: "Inventory", href: "/inventory", permission: "inventory.view_stock", status: "ready" },
  { label: "Customers", href: "/customers", permission: "sales.view", status: "ready" },
  { label: "Suppliers", href: "/suppliers", permission: "purchases.view_suppliers", status: "ready" },
  {
    label: "Distribution",
    href: "/distribution",
    permission: "distribution.view_deliveries",
    status: "ready",
  },
  { label: "Cash & Bank", href: "/cash-bank", permission: "finance.view_cashbook", status: "ready" },
  { label: "Expenses", href: "/cash-bank/expenses", permission: "finance.record_expenses", status: "ready" },
  { label: "Accounting", href: "/accounting", permission: "finance.view_profit", status: "next_phase" },
  { label: "Reports", href: "/reports", permission: "finance.export_financial_reports", status: "next_phase" },
  {
    label: "Insights",
    href: "/insights",
    permission: "dashboard.view_business_insights",
    status: "next_phase",
  },
  { label: "Team", href: "/team", permission: "administration.manage_users", status: "ready" },
  {
    label: "Settings",
    href: "/settings",
    permission: "administration.manage_business_settings",
    status: "ready",
  },
  {
    label: "Branches",
    href: "/settings/branches",
    permission: "administration.manage_business_settings",
    status: "ready",
  },
  {
    label: "Products",
    href: "/inventory/products",
    permission: "inventory.view_stock",
    status: "ready",
  },
  {
    label: "Warehouses",
    href: "/settings/warehouses",
    permission: "administration.manage_business_settings",
    status: "ready",
  },
  { label: "Audit Trail", href: "/audit", permission: "administration.view_audit_logs", status: "ready" },
];
