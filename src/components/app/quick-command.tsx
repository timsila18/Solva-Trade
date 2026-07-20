"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Boxes,
  FileText,
  HelpCircle,
  PackagePlus,
  ReceiptText,
  Search,
  Truck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Command = {
  label: string;
  hint: string;
  href: string;
  group: "Create" | "Find" | "Run";
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
};

const commands: Command[] = [
  { label: "New Sale", hint: "Start a customer invoice", href: "/sales/invoices", group: "Create", keywords: "invoice order sale customer", icon: ReceiptText },
  { label: "New Customer", hint: "Add name, phone and balance", href: "/customers/new", group: "Create", keywords: "client buyer debtor", icon: UserPlus },
  { label: "Receive Stock", hint: "Bring goods into inventory", href: "/purchases/goods-received", group: "Create", keywords: "grn purchase inventory", icon: PackagePlus },
  { label: "New Supplier", hint: "Save supplier contacts and terms", href: "/suppliers/new", group: "Create", keywords: "vendor creditor purchase", icon: Users },
  { label: "Record Payment", hint: "Customer, bank or M-Pesa money in", href: "/cash-bank/receipts", group: "Create", keywords: "receipt mpesa cash bank collection", icon: Banknote },
  { label: "Record Expense", hint: "Capture money paid out", href: "/cash-bank/expenses", group: "Create", keywords: "spend payment cost petty cash", icon: ReceiptText },
  { label: "Transfer Stock", hint: "Move stock between branches", href: "/inventory/transfers", group: "Run", keywords: "warehouse branch stock", icon: Boxes },
  { label: "Generate Report", hint: "Open the reporting hub", href: "/reports", group: "Run", keywords: "statement dashboard export pdf", icon: FileText },
  { label: "Find Customer", hint: "Search customers by name or phone", href: "/customers", group: "Find", keywords: "phone route balance", icon: Search },
  { label: "Find Product", hint: "Search stock, batches and prices", href: "/inventory/products", group: "Find", keywords: "sku item stock price", icon: Boxes },
  { label: "Find Delivery", hint: "Routes, vehicles and driver cash", href: "/distribution", group: "Find", keywords: "truck route vehicle driver", icon: Truck },
  { label: "Get Help", hint: "Open support and training", href: "/support", group: "Run", keywords: "help training support ticket", icon: HelpCircle },
];

export function QuickCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.group} ${command.keywords}`.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-left text-sm text-slate-500 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
      >
        <Search className="h-4 w-4 text-emerald-700" />
        <span className="min-w-0 flex-1 truncate">Search anything or create something new</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30 px-3 py-16 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-white/40 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search className="h-5 w-5 text-emerald-700" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try customer, M-Pesa, stock, report..."
                className="h-11 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Close command search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length ? (
                results.map((command) => {
                  const Icon = command.icon;
                  return (
                    <Link
                      key={`${command.group}-${command.label}`}
                      href={command.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-md px-3 py-3 transition hover:bg-emerald-50"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-800">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-950">{command.label}</span>
                        <span className="block truncate text-sm text-slate-500">{command.hint}</span>
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                        {command.group}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="font-semibold text-slate-950">No match yet</p>
                  <p className="mt-2 text-sm text-slate-500">Try a customer, product, payment, report or command.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
