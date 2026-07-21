import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";

type DashboardTileTone = "blue" | "cyan" | "green" | "gold" | "rose";

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
    <section className="overflow-hidden rounded-lg border border-[var(--solva-border)] bg-[radial-gradient(circle_at_12px_12px,rgb(20_85_217_/_0.05)_2px,transparent_2px),linear-gradient(135deg,#ffffff_0%,#eef6ff_58%,#ecfeff_100%)] bg-[length:28px_28px,auto] p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[var(--solva-blue-700)]">{eyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryAction.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--solva-blue-700)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--solva-navy-900)]"
            >
              <PrimaryIcon className="h-4 w-4" />
              {primaryAction.label}
            </Link>
            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-[var(--solva-blue-700)]"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </div>
        {insight ? (
          <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--solva-blue-700)]">
              <Sparkles className="h-4 w-4" />
              Solva Copilot
            </div>
            <p className="mt-3 text-base leading-7 text-slate-600">{insight}</p>
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
      ? "text-[var(--solva-green-600)] bg-emerald-50"
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
    <div className="rounded-lg border border-dashed border-cyan-300 bg-cyan-50/70 px-5 py-8 text-center">
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      <Link
        href={action.href}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--solva-blue-700)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--solva-navy-900)]"
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
      className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
    >
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--solva-blue-700)]">
        {action}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function DashboardTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  caption: string;
  icon?: LucideIcon;
  tone?: DashboardTileTone;
}) {
  const toneClass: Record<DashboardTileTone, string> = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    gold: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        {Icon ? (
          <span className={`grid h-10 w-10 place-items-center rounded-md ${toneClass[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-slate-500">{caption}</p>
    </article>
  );
}

export function DashboardPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="flex-1 rounded-t-md bg-[var(--solva-blue-700)]"
          style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function ProgressRow({ label, value, amount }: { label: string; value: number; amount: string }) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-950">{amount}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--solva-cyan-500)]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
