"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/app/searchable-select";

export function ProductQuantityReportForm({ products, today }: { products: { id: string; label: string }[]; today: string }) {
  const [period, setPeriod] = useState("monthly");
  const inputClass = "mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";
  return <form action="/api/exports" target="_blank" className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-end">
    <input type="hidden" name="module" value="Sales" />
    <input type="hidden" name="process" value="Product Quantity Sales Report" />
    <label className="text-sm font-semibold text-slate-700">Product<SearchableSelect name="productId" label="Report product" allLabel="All products" options={products} /></label>
    <label className="text-sm font-semibold text-slate-700">Period<select name="period" value={period} onChange={(event) => setPeriod(event.currentTarget.value)} className={inputClass}>
      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom dates</option>
    </select></label>
    {period === "custom" ? <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-700">From<input name="from" type="date" defaultValue={`${today.slice(0, 7)}-01`} required className={inputClass} /></label><label className="text-sm font-semibold text-slate-700">To<input name="to" type="date" defaultValue={today} required className={inputClass} /></label></div> : <label className="text-sm font-semibold text-slate-700">Report date<input name="date" type="date" defaultValue={today} required className={inputClass} /></label>}
    <div className="grid gap-2 sm:grid-cols-3 xl:min-w-72">
      <button name="format" value="pdf" className="min-h-11 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">PDF</button>
      <button name="format" value="excel" className="min-h-11 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-[var(--solva-blue-700)]">Excel</button>
      <button name="format" value="print" className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Print</button>
    </div>
  </form>;
}
