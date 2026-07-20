import Link from "next/link";
import {
  commercialPlans,
  lifecycleStatuses,
  productionEnvReference,
} from "@/lib/saas-platform-data";

const checkoutSteps = [
  "Select plan",
  "Select billing interval",
  "Review limits and features",
  "Enter billing details",
  "Apply valid discount",
  "Calculate taxes",
  "Select payment method",
  "Create payment request",
  "Verify payment",
  "Activate subscription",
  "Issue receipt or invoice",
  "Update billing history",
  "Send confirmation",
  "Record audit event",
];

const paymentFoundations = [
  ["M-Pesa", "STK Push, Paybill/Till, checkout IDs, masked phone, verified callback, retry and reconciliation."],
  ["Card", "Checkout session, customer reference, payment intent, token reference, webhook verification and refund foundation."],
  ["Bank transfer", "Reference, evidence, recorded by, verified by and duplicate-reference review."],
  ["Manual payment", "Platform finance verification required before activation."],
  ["Invoice billing", "Manual invoice foundation with due date, payment status and receipt reference."],
  ["Partner paid", "Partner or reseller pricing foundation."],
  ["Promotional", "Controlled access with expiry and audit history."],
];

export default function BillingPage() {
  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Subscription and billing</p>
          <h1 className="mt-1 text-3xl font-semibold">Billing Centre</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Tenant-visible plan, trial, usage, invoices, payments, upgrades, downgrades, cancellation, export and retention foundations.
          </p>
        </div>
        <Link href="/launch-readiness" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
          Launch readiness
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Current plan", "No active subscription"],
          ["Trial status", "Not started"],
          ["Renewal date", "Not scheduled"],
          ["Usage status", "No billing period"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <h2 className="mt-3 text-xl font-semibold">{value}</h2>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-4">
        {commercialPlans.map((plan) => (
          <article key={plan.code} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{plan.currency} {plan.basePrice.toLocaleString()} / {plan.interval}</p>
            <p className="mt-3 text-sm text-slate-600">{plan.trialDays} trial days</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              {Object.entries(plan.limits).slice(0, 5).map(([metric, limit]) => (
                <div key={metric} className="flex justify-between gap-3 rounded-md bg-slate-100 px-3 py-2">
                  <span>{metric}</span>
                  <span className="font-semibold">{limit ?? "Negotiated"}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Checkout Workflow</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {checkoutSteps.map((step, index) => (
              <div key={step} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{index + 1}. </span>{step}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Paid subscriptions activate only after trusted backend payment verification, never from client-side success alone.
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Payment Foundations</h2>
          <div className="mt-4 grid gap-3">
            {paymentFoundations.map(([name, body]) => (
              <div key={name} className="rounded-md bg-slate-100 px-3 py-3 text-sm">
                <span className="font-semibold">{name}</span>
                <p className="mt-1 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Lifecycle Effects</h2>
          <div className="mt-4 grid gap-2">
            {lifecycleStatuses.map(([status, body]) => (
              <div key={status} className="rounded-md border border-slate-200 px-3 py-3 text-sm">
                <span className="font-semibold">{status}</span>
                <p className="mt-1 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Billing Environment</h2>
          <div className="mt-4 grid gap-2">
            {productionEnvReference.filter(([name]) => name.includes("MPESA") || name.includes("CARD") || name.includes("WEBHOOK") || name.includes("EMAIL")).map(([name, purpose, env, scope]) => (
              <div key={name} className="rounded-md bg-slate-100 px-3 py-3 text-sm">
                <span className="font-semibold">{name}</span>
                <p className="mt-1 text-slate-600">{purpose} · {env} · {scope}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
