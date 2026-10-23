"use client";

import { useMemo, useState } from "react";

export function SearchableSelect({ name, label, allLabel, options }: {
  name: string; label: string; allLabel: string; options: { id: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => options.filter((option) => option.id === selectedId || option.label.toLocaleLowerCase().startsWith(normalized)), [normalized, options, selectedId]);
  return <span className="mt-2 grid gap-2">
    <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={query}
      onChange={(event) => setQuery(event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" />
    <select name={name} aria-label={label} value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)} className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
      <option value="">{allLabel}</option>
      {visible.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </span>;
}
