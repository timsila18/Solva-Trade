"use client";

import { useMemo, useState } from "react";
import { normalizeProductSearch, productSearchScore } from "@/lib/product-search";

export function SearchableSelect({ name, label, allLabel, options, defaultValue = "", searchMode = "prefix" }: {
  name: string; label: string; allLabel: string; options: { id: string; label: string }[]; defaultValue?: string; searchMode?: "prefix" | "contains";
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);
  const normalized = query.trim().toLocaleLowerCase();
  const indexed = useMemo(() => options.map((option) => ({ option, text: normalizeProductSearch(option.label) })), [options]);
  const visible = useMemo(() => searchMode === "contains"
    ? indexed.map(({ option, text }) => ({ option, score: productSearchScore(text, normalizeProductSearch(query)) }))
      .filter(({ score }) => score >= 0).sort((a, b) => a.score - b.score).map(({ option }) => option)
    : options.filter((option) => option.id === selectedId || option.label.toLocaleLowerCase().startsWith(normalized)), [indexed, normalized, options, query, searchMode, selectedId]);
  const selected = options.find((option) => option.id === selectedId);
  return <span className="mt-2 grid gap-2">
    <input type="search" autoComplete="off" spellCheck={false} aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={query}
      onChange={(event) => setQuery(event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" />
    <select name={name} aria-label={label} size={searchMode === "contains" && normalized ? 6 : undefined} value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)} className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
      <option value="">{allLabel}</option>
      {selected && !visible.some((option) => option.id === selectedId) ? <option value={selectedId} hidden>{selected.label}</option> : null}
      {visible.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    {searchMode === "contains" && normalized ? <span role="status" className="text-xs font-normal text-slate-500">{visible.length ? `${visible.length} matching products` : "No matching products"}</span> : null}
  </span>;
}
