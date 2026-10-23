"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type Item = { id: string; name: string; terms: string[]; content: ReactNode };
const normalise = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function LiveRecordList({ items, label, initialQuery = "", header, minWidth = "min-w-[920px]" }: {
  items: Item[]; label: string; initialQuery?: string; header: ReactNode; minWidth?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const index = useMemo(() => items.map((item) => ({ item, terms: [item.name, ...item.terms].map(normalise) })), [items]);
  const needle = normalise(query);
  const matches = index.filter(({ terms }) => !needle || terms.some((term) => term.startsWith(needle)));
  return <div className="mt-4">
    <div className="relative mb-3">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" aria-label={label} placeholder={label} value={query} onChange={(event) => setQuery(event.currentTarget.value)} className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-11 text-sm" />
      {query ? <button type="button" title="Clear search" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
    </div>
    <p role="status" className="mb-2 text-xs text-slate-500">{matches.length} of {items.length} records</p>
    <div className="overflow-x-auto"><div className={minWidth}>{header}{matches.map(({ item }) => <div key={item.id}>{item.content}</div>)}</div></div>
    {!matches.length ? <p className="p-4 text-sm text-slate-500">{items.length ? "No records match your search." : "No records yet."}</p> : null}
  </div>;
}
