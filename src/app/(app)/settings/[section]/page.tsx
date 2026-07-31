import Link from "next/link";
import { notFound } from "next/navigation";
import { completeProcessAction } from "@/app/(app)/actions";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import {
  buildDocumentPreview,
  findSettingsSection,
  industryProfiles,
  settingsSections,
} from "@/lib/configuration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type BusinessSettings = {
  legal_name: string | null;
  trading_name: string | null;
  kra_pin: string | null;
  phone: string | null;
  alternative_phone: string | null;
  email: string | null;
  website: string | null;
  physical_address: string | null;
  postal_address: string | null;
  town: string | null;
  county: string | null;
  country: string | null;
  invoice_footer: string | null;
  terms_and_conditions: string | null;
  default_customer_message: string | null;
  payment_details: unknown;
};

type PaymentDetails = {
  payment_display_name?: string;
  paybill_number?: string;
  paybill_account_number?: string;
  till_number?: string;
  pochi_la_biashara_phone?: string;
  send_money_phone?: string;
  cheque_payee?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  bank_name?: string;
  bank_account_name?: string;
};

export function generateStaticParams() {
  return settingsSections.map((section) => ({ section: section.slug }));
}

function paymentDetailsFromJson(value: unknown): PaymentDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string")
      .map(([key, item]) => [key, String(item)]),
  ) as PaymentDetails;
}

async function loadBusinessSettings(slug: string) {
  if (slug !== "business-profile" && slug !== "payments") return null;
  const businessId = await getActiveBusinessId();
  if (!businessId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "legal_name, trading_name, kra_pin, phone, alternative_phone, email, website, physical_address, postal_address, town, county, country, invoice_footer, terms_and_conditions, default_customer_message, payment_details",
    )
    .eq("id", businessId)
    .maybeSingle<BusinessSettings>();
  return data ?? null;
}

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        name={`field_${name}`}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder ?? label}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
      <input type="hidden" name={`label_${name}`} value={label} />
    </label>
  );
}

function TextAreaField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold md:col-span-2">
      {label}
      <textarea
        name={`field_${name}`}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder ?? label}
        className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
      <input type="hidden" name={`label_${name}`} value={label} />
    </label>
  );
}

function BusinessProfileFields({ business }: { business: BusinessSettings | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField name="legal_name" label="Legal name" defaultValue={business?.legal_name} required />
      <TextField name="trading_name" label="Trading name shown in the app and documents" defaultValue={business?.trading_name} required />
      <TextField name="kra_pin" label="KRA PIN" defaultValue={business?.kra_pin} />
      <TextField name="phone" label="Primary phone" defaultValue={business?.phone} />
      <TextField name="alternative_phone" label="Alternative phone" defaultValue={business?.alternative_phone} />
      <TextField name="email" label="Business email" type="email" defaultValue={business?.email} />
      <TextField name="website" label="Website" defaultValue={business?.website} />
      <TextField name="town" label="Town" defaultValue={business?.town} />
      <TextField name="county" label="County" defaultValue={business?.county} />
      <TextField name="country" label="Country" defaultValue={business?.country ?? "Kenya"} />
      <TextAreaField name="physical_address" label="Physical address" defaultValue={business?.physical_address} />
      <TextAreaField name="postal_address" label="Postal address" defaultValue={business?.postal_address} />
      <TextAreaField name="invoice_footer" label="Invoice footer note" defaultValue={business?.invoice_footer} />
      <TextAreaField name="terms_and_conditions" label="Terms and conditions" defaultValue={business?.terms_and_conditions} />
      <TextAreaField name="default_customer_message" label="Default customer message" defaultValue={business?.default_customer_message} />
    </div>
  );
}

function PaymentMethodFields({ business }: { business: BusinessSettings | null }) {
  const details = paymentDetailsFromJson(business?.payment_details);
  const businessName = business?.trading_name || business?.legal_name || "";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField
        name="payment_display_name"
        label="Payment display name"
        defaultValue={details.payment_display_name ?? businessName}
        placeholder="Name customers should see when paying"
        required
      />
      <TextField name="till_number" label="M-Pesa Till number" defaultValue={details.till_number} placeholder="8060990" />
      <TextField name="send_money_phone" label="Send Money M-Pesa number" defaultValue={details.send_money_phone} placeholder="0720243591" />
      <TextField name="cheque_payee" label="Cheque payee name" defaultValue={details.cheque_payee ?? businessName} placeholder="Cymereg Enterprise" />
      <TextField name="paybill_number" label="Paybill number" defaultValue={details.paybill_number} />
      <TextField name="paybill_account_number" label="Paybill account number" defaultValue={details.paybill_account_number} />
      <TextField name="pochi_la_biashara_phone" label="Pochi la Biashara phone" defaultValue={details.pochi_la_biashara_phone} />
      <TextField name="contact_phone" label="Payment help contact phone" defaultValue={details.contact_phone ?? business?.phone} />
      <TextField name="whatsapp_number" label="Payment help WhatsApp" defaultValue={details.whatsapp_number ?? business?.phone} />
      <TextField name="bank_name" label="Bank name" defaultValue={details.bank_name} />
      <TextField name="bank_account_name" label="Bank account name" defaultValue={details.bank_account_name} />
    </div>
  );
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = findSettingsSection(slug);
  if (!section) notFound();
  const businessSettings = await loadBusinessSettings(slug);

  const documentPreview = buildDocumentPreview({
    prefix: "INV",
    branchCode: "NRB",
    year: 2026,
    number: 1,
  });

  return (
    <div className="pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/settings" className="text-sm font-semibold text-emerald-700">
            Settings
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">{section.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{section.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/exports?module=Settings&process=${encodeURIComponent(section.title)}&format=csv`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            Export CSV
          </Link>
          <Link
            href={`/api/exports?module=Settings&process=${encodeURIComponent(`${section.title} import template`)}&format=excel`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            Import template
          </Link>
          <Link
            href="#configuration-fields"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Save changes
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {section.metrics.map((metric) => (
          <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
          </article>
        ))}
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Audit logging</p>
          <p className="mt-2 text-xl font-semibold">Enabled</p>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={`Search ${section.title.toLowerCase()}`}
          />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="active">
            <option value="active">Active only</option>
            <option value="inactive">Inactive</option>
            <option value="all">All statuses</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="all">
            <option value="all">All branches</option>
            <option value="nrb">Nairobi Depot</option>
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <form id="configuration-fields" action={completeProcessAction} className="rounded-lg border border-slate-200 bg-white p-5">
          <input type="hidden" name="module" value="Settings" />
          <input type="hidden" name="process" value={section.title} />
          <input type="hidden" name="intent" value="Settings saved" />
          <input type="hidden" name="returnTo" value={`/settings/${slug}`} />
          <input type="hidden" name="next" value="Continue settings" />
          <h2 className="text-lg font-semibold">Configuration fields</h2>
          <p className="mt-1 text-sm text-slate-600">
            Save once here and Solva Trade will use these details across the tenant workspace and relevant documents.
          </p>
          <div className="mt-5">
            {slug === "business-profile" ? (
              <BusinessProfileFields business={businessSettings} />
            ) : slug === "payments" ? (
              <PaymentMethodFields business={businessSettings} />
            ) : (
              <WorkflowFormFields fields={section.fields.slice(0, 10)} />
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" defaultChecked />
              Active
            </label>
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" />
              Default
            </label>
            <label className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
              <input type="checkbox" defaultChecked />
              Tenant scoped
            </label>
          </div>
          <button className="mt-6 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
            Save configuration
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Import safety</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Validate every row before commit.</li>
              <li>Reject duplicate codes within the business.</li>
              <li>Show row-level errors in preview.</li>
              <li>Create audit events after successful import.</li>
            </ul>
          </section>

          {slug === "documents" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Number preview</h2>
              <p className="mt-3 rounded-md bg-slate-950 px-3 py-3 font-mono text-sm text-white">{documentPreview}</p>
              <p className="mt-3 text-sm text-slate-600">
                Real numbers are generated server-side with row locking and immutable sequence history.
              </p>
            </section>
          ) : null}

          {slug === "payments" ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-950">Document payment instructions</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                Save Paybill, Till, Pochi, send-money, WhatsApp or bank details here. Solva prints them consistently on invoices,
                receipts, customer statements, quotations, proformas and payment vouchers.
              </p>
            </section>
          ) : null}

          {slug === "tax" ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">Tax disclaimer</h2>
              <p className="mt-2 text-sm text-amber-900">
                KRA PIN checks are format-only here. Direct KRA or eTIMS verification is not implemented in this phase.
              </p>
            </section>
          ) : null}

          {slug === "industry-profiles" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Feature flags</h2>
              <div className="mt-3 space-y-3">
                {Object.entries(industryProfiles).map(([key, profile]) => (
                  <details key={key} className="rounded-md border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">{profile.label}</summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.flags.map((flag) => (
                        <span key={flag} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                          {flag.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-4 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>Name</span>
          <span>Code or type</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {section.fields.slice(0, 6).map((field, index) => (
          <div key={field} className="grid grid-cols-4 gap-3 border-b border-slate-100 px-4 py-3 text-sm">
            <span className="font-medium">{field}</span>
            <span className="text-slate-600">{field.toLowerCase().replaceAll(" ", "_")}</span>
            <span className="text-emerald-700">{index < 2 ? "Configured" : "Ready"}</span>
            <Link href="#configuration-fields" className="w-fit text-sm font-semibold text-emerald-700">Edit</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
