"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FileText, Search, X } from "lucide-react";

export type SalesHistoryRow = {
  id: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  paid: number;
  phone: string;
};

const PAGE_SIZE = 50;
function normalise(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function HistoryList({ rows, initialQuery }: { rows: SalesHistoryRow[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const matches = useMemo(() => {
    const needle = normalise(query);
    return rows.filter((row) => !needle
      || normalise(row.customerName).startsWith(needle)
      || normalise(row.invoiceNumber).startsWith(needle)
      || (/\d/.test(needle) && normalise(`${row.invoiceDate} ${row.total} ${row.paid} ${row.phone}`).includes(needle)));
  }, [rows, query]);
  const visible = matches.slice(0, limit);
  const updateQuery = (value: string) => { setQuery(value); setLimit(PAGE_SIZE); };
  return <div className="max-h-[72vh] overflow-auto p-4">
    <div className="relative mb-3">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" aria-label="Search Sales History" placeholder="Search customer or invoice" value={query}
        onChange={(event) => updateQuery(event.currentTarget.value)}
        className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-11 text-sm font-semibold text-slate-800" />
      {query ? <button type="button" aria-label="Clear search sales history" title="Clear search" onClick={() => updateQuery("")}
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
    </div>
    <p role="status" className="mb-2 text-xs text-slate-500">{matches.length} of {rows.length} invoices; showing {visible.length}</p>
    <div className="grid gap-2">
      {visible.map((row) => {
        const href = (process: string) => `/api/exports?${new URLSearchParams({ module: "Sales", process, format: "pdf", invoiceId: row.id })}`;
        return <div key={row.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 break-words">
              <p className="font-semibold text-slate-950">{row.invoiceNumber || "Sale without number"}</p>
              <p className="text-xs text-slate-500">{row.customerName} - {row.invoiceDate || "not dated"}</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">PAID</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-800">KES {row.total.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className="flex flex-wrap gap-2">
              <a href={href("Invoice")} className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">Invoice</a>
              <a href={href("Sales Receipt")} className="inline-flex min-h-9 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white">Receipt</a>
            </div>
          </div>
        </div>;
      })}
    </div>
    {!matches.length ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{rows.length ? "No invoice matches that search." : "No invoices yet."}</p> : null}
    {visible.length < matches.length ? <button type="button" onClick={() => setLimit((value) => value + PAGE_SIZE)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold"><ChevronDown aria-hidden="true" className="h-4 w-4" />Load more</button> : null}
  </div>;
}

export function SalesHistory({ rows, initialQuery = "" }: { rows: SalesHistoryRow[]; initialQuery?: string }) {
  const [open, setOpen] = useState(Boolean(initialQuery));
  return <details className="mt-4 rounded-md border border-slate-200 bg-white" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--solva-blue-800)]">
      <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />Sales History</span>
      <span className="rounded-full bg-white/15 px-2 py-1 text-xs">{rows.length}</span>
    </summary>
    {open ? <HistoryList rows={rows} initialQuery={initialQuery} /> : null}
  </details>;
}
