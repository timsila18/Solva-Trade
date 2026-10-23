"use client";

import { Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";

type InvoiceSearchItem = {
  id: string;
  customerName: string;
  invoiceNumber: string;
  otherDetails?: string;
  content: ReactNode;
};

function normalise(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function CustomerInvoiceSearch({ items, initialQuery = "", label, listClassName = "grid gap-2" }: {
  items: InvoiceSearchItem[];
  initialQuery?: string;
  label: string;
  listClassName?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const needle = normalise(query);
  const visibleItems = items.filter((item) => !needle
    || normalise(item.customerName).startsWith(needle)
    || normalise(item.invoiceNumber).startsWith(needle)
    || (/\d/.test(needle) && normalise(item.otherDetails ?? "").includes(needle)));

  return (
    <div>
      <div className="relative mb-3">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="search" aria-label={label} placeholder="Search customer or invoice" value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-11 text-sm font-semibold text-slate-800" />
        {query ? <button type="button" aria-label={`Clear ${label.toLowerCase()}`} title="Clear search" onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
      </div>
      <p role="status" className="mb-2 text-xs text-slate-500">{visibleItems.length} of {items.length} invoices</p>
      <div className={listClassName}>
        {visibleItems.map((item) => <div key={item.id}>{item.content}</div>)}
      </div>
      {!visibleItems.length ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{items.length ? "No invoice matches that search." : "No invoices yet."}</p> : null}
    </div>
  );
}
