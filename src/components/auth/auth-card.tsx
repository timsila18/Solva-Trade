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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#064e3b_0,#0f172a_36rem,#020617_100%)] px-4 py-10 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <div>
          <div className="max-w-md overflow-hidden rounded-lg border border-cyan-300/20 bg-[#03111f] p-3 shadow-2xl shadow-blue-950/40">
            <Image
              src="/solva-trade-logo.png"
              alt="Solva Trade"
              width={920}
              height={458}
              priority
              className="h-auto w-full"
            />
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-normal sm:text-5xl">
            Run sales, stock and money without learning accounting software.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            Built for Kenyan SMEs that need enterprise power, plain language and a business manager&apos;s view of what to do next.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">Plain-language guidance</p>
              <p className="mt-1 text-sm text-slate-300">Know who owes you, what is low, and what needs attention.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">Built for trust</p>
              <p className="mt-1 text-sm text-slate-300">Tenant isolation, roles and audit foundations are designed in.</p>
            </div>
          </div>
        </div>
        <form action={action} method="post" className="rounded-lg border border-white/40 bg-white p-6 text-slate-950 shadow-2xl">
          <h2 className="text-2xl font-semibold">{title}</h2>
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
              <input name="email" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" type="email" autoComplete="email" required />
            </label>
          ) : null}
          {mode === "create-account" ? (
            <label className="mt-4 block text-sm font-medium">
              Full name
              <input name="full_name" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" autoComplete="name" required />
            </label>
          ) : null}
          {mode === "forgot" ? (
            <label className="mt-5 block text-sm font-medium">
              Account email
              <input name="email" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" type="email" autoComplete="email" required />
            </label>
          ) : null}
          {mode !== "forgot" && mode !== "invitation" ? (
            <label className="mt-4 block text-sm font-medium">
              Password
              <input name="password" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required />
            </label>
          ) : null}
          {mode === "reset" ? (
            <label className="mt-4 block text-sm font-medium">
              Confirm password
              <input name="confirm_password" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" type="password" autoComplete="new-password" required />
            </label>
          ) : null}
          <button className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800">
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
