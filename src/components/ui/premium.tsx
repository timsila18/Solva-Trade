import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";

export function PageHero({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  insight,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: { label: string; href: string; icon?: LucideIcon };
  secondaryAction?: { label: string; href: string };
  insight?: string;
}) {
  const PrimaryIcon = primaryAction.icon ?? ArrowRight;

  return (
    <section className="overflow-hidden rounded-lg border border-emerald-900/10 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_52%,#ecfeff_100%)] p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">{eyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryAction.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              <PrimaryIcon className="h-4 w-4" />
              {primaryAction.label}
            </Link>
            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </div>
        {insight ? (
          <div className="rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Sparkles className="h-4 w-4" />
              Solva Copilot
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{insight}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  story,
  tone = "neutral",
}: {
  label: string;
  value: string;
  story: string;
  tone?: "neutral" | "good" | "warning";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "warning"
        ? "text-amber-700 bg-amber-50"
        : "text-slate-600 bg-slate-100";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className={`mt-4 rounded-md px-3 py-2 text-sm ${toneClass}`}>{story}</p>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: { label: string; href: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 px-5 py-8 text-center">
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      <Link
        href={action.href}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
      >
        {action.label}
      </Link>
    </div>
  );
}

export function PlainCard({
  title,
  description,
  href,
  action = "Open",
}: {
  title: string;
  description: string;
  href: string;
  action?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
