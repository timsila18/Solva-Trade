import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function AuthCard({
  title,
  subtitle,
  mode,
  error,
  message,
}: {
  title: string;
  subtitle: string;
  mode: "sign-in" | "create-account" | "forgot" | "reset" | "invitation";
  error?: string;
  message?: string;
}) {
  const action =
    mode === "sign-in"
      ? "/api/auth/sign-in"
      : mode === "create-account"
        ? "/api/auth/create-account"
        : mode === "forgot"
          ? "/api/auth/forgot-password"
          : mode === "reset"
            ? "/api/auth/reset-password"
            : undefined;

  return (
    <main className="min-h-screen bg-[#071a2b] px-4 py-8 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative bg-[#03111f] p-8 sm:p-10 lg:p-12">
          <div className="max-w-sm overflow-hidden rounded-[6px] border border-cyan-300/20 bg-[#03111f] p-3">
            <Image
              src="/solva-trade-logo.png"
              alt="Solva Trade"
              width={920}
              height={458}
              priority
              className="h-auto w-full"
            />
          </div>
          <h1 className="mt-8 max-w-2xl text-[2.65rem] font-semibold leading-tight tracking-normal">
            Run the business from one clean operating desk.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Sales, stock receipts, customer balances, cash, VAT treatment and daily reports stay in one tenant-controlled workspace.
          </p>
          <div className="mt-8 grid gap-3">
            <div className="border border-white/10 bg-white/[0.06] p-4">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">Daily operating clarity</p>
              <p className="mt-1 text-sm text-slate-300">Know what sold, what was paid, what is low, and what needs follow-up.</p>
            </div>
            <div className="border border-white/10 bg-white/[0.06] p-4">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">Business records you can defend</p>
              <p className="mt-1 text-sm text-slate-300">Role-based access, tenant data, branded exports and audit-ready document trails.</p>
            </div>
          </div>
        </div>
        <form action={action} method="post" className="bg-white p-8 text-slate-950 sm:p-10 lg:p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Secure workspace</p>
          <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
              {message}
            </p>
          ) : null}
          {mode !== "forgot" && mode !== "reset" ? (
            <label className="mt-5 block text-sm font-medium">
              Email
              <input name="email" className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2" type="email" autoComplete="email" required />
            </label>
          ) : null}
          {mode === "create-account" ? (
            <label className="mt-4 block text-sm font-medium">
              Full name
              <input name="full_name" className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2" autoComplete="name" required />
            </label>
          ) : null}
          {mode === "forgot" ? (
            <label className="mt-5 block text-sm font-medium">
              Account email
              <input name="email" className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2" type="email" autoComplete="email" required />
            </label>
          ) : null}
          {mode !== "forgot" && mode !== "invitation" ? (
            <label className="mt-4 block text-sm font-medium">
              Password
              <input name="password" className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required />
            </label>
          ) : null}
          {mode === "reset" ? (
            <label className="mt-4 block text-sm font-medium">
              Confirm password
              <input name="confirm_password" className="mt-2 min-h-11 w-full rounded-[6px] border border-slate-300 px-3 py-2" type="password" autoComplete="new-password" required />
            </label>
          ) : null}
          <button className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--solva-blue-700)]">
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
          <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-slate-600">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/create-account">Create account</Link>
            <Link href="/forgot-password">Forgot password</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
