"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, FileText, LockKeyhole, TrendingDown, TrendingUp } from "lucide-react";

type ProfitPeriod = {
  label: string;
  value: string;
  amount: number;
  caption: string;
};

function money(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}KES ${Math.abs(Math.round(value)).toLocaleString("en-KE")}`;
}

export function ProfitPrivacyCard({
  businessName,
  pin,
  periods,
}: {
  businessName: string;
  pin: string;
  periods: ProfitPeriod[];
}) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(periods[0]?.value ?? "today");
  const current = periods.find((period) => period.value === active) ?? periods[0];
  const isLoss = (current?.amount ?? 0) < 0;

  function unlock() {
    if (entry.trim() === pin) {
      setOpen(true);
      setEntry("");
      setError("");
      return;
    }
    setOpen(false);
    setError("Wrong PIN. Profit remains hidden.");
  }

  function lock() {
    setOpen(false);
    setEntry("");
    setError("");
  }

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-slate-900 bg-[var(--solva-navy-950)] text-white shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px] lg:items-stretch">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Owner profit safe</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">Profit highlights</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Profit is private. Unlock with the owner PIN to view today, week and year performance for {businessName}.
              </p>
            </div>
            <button
              type="button"
              onClick={open ? lock : undefined}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white"
              aria-label={open ? "Hide profit" : "Profit hidden"}
            >
              {open ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {open ? "Hide" : "Hidden"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.value}
                type="button"
                onClick={() => setActive(period.value)}
                className={`min-h-10 rounded-md px-3 text-sm font-semibold ${
                  active === period.value
                    ? "bg-cyan-300 text-slate-950"
                    : "border border-white/15 bg-white/5 text-slate-200"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-200">{current?.label ?? "Profit"}</p>
                <p className={`mt-2 text-4xl font-black tracking-normal ${open ? (isLoss ? "text-rose-200" : "text-white") : "text-white"}`}>
                  {open ? money(current?.amount ?? 0) : "KES ******"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {open ? current?.caption : "Enter the owner PIN to reveal this figure. Losses appear as negative profit."}
                </p>
              </div>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md ${isLoss ? "bg-rose-400/15 text-rose-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                {isLoss ? <TrendingDown className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white p-4 text-slate-950">
          <div className="flex items-center gap-2 text-[var(--solva-blue-700)]">
            <LockKeyhole className="h-5 w-5" />
            <h3 className="font-semibold">Unlock profit</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Owner-only view. For Cymereg Enterprise, use the profit PIN provided by the owner.</p>
          <div className="mt-4 grid gap-2">
            <label className="text-sm font-semibold" htmlFor="profit-pin">Profit PIN</label>
            <input
              id="profit-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={entry}
              onChange={(event) => {
                setEntry(event.target.value.replace(/\D/g, ""));
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlock();
              }}
              className="min-h-11 rounded-md border border-slate-300 px-3 text-lg font-semibold tracking-[0.18em]"
              placeholder="****"
            />
            {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
            <button type="button" onClick={unlock} className="min-h-11 rounded-md bg-[var(--solva-blue-700)] px-4 text-sm font-semibold text-white">
              Open profit view
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ["Profit & Loss", "/api/exports?module=Finance&process=Profit%20and%20Loss%20Report&format=pdf"],
              ["Trial Balance", "/api/exports?module=Finance&process=Trial%20Balance%20Report&format=pdf"],
              ["Balance Sheet", "/api/exports?module=Finance&process=Balance%20Sheet&format=pdf"],
            ].map(([label, href]) => (
              <Link key={label} href={href} className="inline-flex min-h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                {label}
                <FileText className="h-4 w-4 text-[var(--solva-blue-700)]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
