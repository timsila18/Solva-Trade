"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, FileText, LockKeyhole, TrendingDown, TrendingUp } from "lucide-react";
import { PinProtectedExportLink } from "@/components/app/pin-protected-export";

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
    setError("Wrong PIN");
  }

  function lock() {
    setOpen(false);
    setEntry("");
    setError("");
  }

  return (
    <article className="relative border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Profit</p>
          <p className={`mt-2 text-2xl font-semibold ${open && isLoss ? "text-rose-700" : "text-slate-950"}`}>
            {open ? money(current?.amount ?? 0) : "KES ******"}
          </p>
        </div>
        <button
          type="button"
          onClick={open ? lock : undefined}
          className={`grid h-10 w-10 place-items-center rounded-[6px] ${open ? (isLoss ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700") : "bg-slate-100 text-slate-700"}`}
          aria-label={open ? "Hide profit" : "Profit is locked"}
          title={open ? "Hide profit" : "Profit is locked"}
        >
          {open ? (isLoss ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />) : <EyeOff className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="mt-3">
          <p className="text-sm text-slate-500">{current?.caption}</p>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {periods.map((period) => (
              <button
                key={period.value}
                type="button"
                onClick={() => setActive(period.value)}
                className={`min-h-9 rounded-md px-2 text-xs font-semibold ${
                  active === period.value ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <Link
            href="/api/exports?module=Finance&process=Profit%20and%20Loss%20Report&format=pdf"
            className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700"
          >
            <FileText className="h-4 w-4 text-[var(--solva-blue-700)]" />
            Profit & Loss PDF
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              href="/api/exports?module=Sales&process=Profit%20by%20Customer%20Report&format=pdf"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 px-2 text-center text-[11px] font-semibold text-[var(--solva-blue-700)]"
            >
              Customer profit
            </Link>
            <PinProtectedExportLink
              href="/api/exports?module=Sales&process=Profit%20by%20Supplier%20and%20Source%20Report&format=pdf"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-cyan-200 px-2 text-center text-[11px] font-semibold text-[var(--solva-blue-700)]"
            >
              Supplier profit
            </PinProtectedExportLink>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-500">Private owner view</p>
          <div className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="profit-pin">Profit PIN for {businessName}</label>
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
              className="min-h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm font-semibold tracking-[0.18em]"
              placeholder="PIN"
            />
            <button
              type="button"
              onClick={unlock}
              className="grid h-9 w-10 place-items-center rounded-md bg-slate-950 text-white"
              aria-label="Open profit"
              title="Open profit"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
          {error ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              {error}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
