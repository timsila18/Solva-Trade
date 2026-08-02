import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { completeProcessAction } from "@/app/(app)/actions";
import { PersistedForm } from "@/components/app/persisted-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function paymentLabel(value: string | null) {
  const map: Record<string, string> = {
    due_immediately: "Cash",
    cash: "Cash",
    "pay in 7 days": "Pay in 7 days",
    "pay in 14 days": "Pay in 14 days",
    "pay in 30 days": "Pay in 30 days",
  };
  return map[String(value ?? "").toLowerCase()] ?? "Cash";
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const businessId =
    (await getActiveBusinessId()) ||
    (typeof userData.user?.app_metadata?.active_business_id === "string" ? userData.user.app_metadata.active_business_id : null);
  if (!businessId) notFound();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_code, customer_name, phone, email, kra_pin, credit_limit, current_balance, default_payment_terms, active, status")
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const { data: address } = await supabase
    .from("customer_addresses")
    .select("town, delivery_instructions, contact_person, contact_phone")
    .eq("business_id", businessId)
    .eq("customer_id", id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const route = text(address?.delivery_instructions).replace(/^Preferred route:\s*/i, "");

  return (
    <div className="pb-24">
      <div className="border-b border-slate-200 bg-white px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--solva-blue-700)]">Customer control</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Edit customer</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Owners can update saved customer details used by sales, delivery, credit follow-up, statements and customer-profile exports.
        </p>
        <Link href="/customers" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[6px] border border-slate-300 px-4 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>
      </div>

      <PersistedForm action={completeProcessAction} draftKey={`solva-trade:customer-edit:${id}`} className="mt-6 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <input type="hidden" name="module" value="Customers" />
        <input type="hidden" name="process" value="Edit Customer" />
        <input type="hidden" name="document" value="Customer Profile" />
        <input type="hidden" name="intent" value="Customer updated" />
        <input type="hidden" name="returnTo" value="/customers" />
        <input type="hidden" name="next" value="Back to customers" />
        <input type="hidden" name="label_customer_id" value="Customer ID" />
        <input type="hidden" name="field_customer_id" value={id} />

        <label className="text-sm font-medium">
          Customer name
          <input type="hidden" name="label_customer_name" value="Customer name" />
          <input name="field_customer_name" defaultValue={text(customer.customer_name)} required className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Phone number
          <input type="hidden" name="label_phone_number" value="Phone number" />
          <input name="field_phone_number" defaultValue={text(customer.phone)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Town or area
          <input type="hidden" name="label_town_or_area" value="Town or area" />
          <input name="field_town_or_area" defaultValue={text(address?.town)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Delivery route
          <input type="hidden" name="label_delivery_route" value="Delivery route" />
          <input name="field_delivery_route" defaultValue={route} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          KRA PIN
          <input type="hidden" name="label_kra_pin" value="KRA PIN" />
          <input name="field_kra_pin" defaultValue={text(customer.kra_pin)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Email
          <input type="hidden" name="label_email" value="Email" />
          <input name="field_email" type="email" defaultValue={text(customer.email)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Current balance
          <input type="hidden" name="label_opening_balance" value="Current balance" />
          <input name="field_opening_balance" type="number" min="0" step="0.01" defaultValue={numberValue(customer.current_balance)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Credit limit
          <input type="hidden" name="label_credit_limit" value="Credit limit" />
          <input name="field_credit_limit" type="number" min="0" step="0.01" defaultValue={numberValue(customer.credit_limit)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="text-sm font-medium">
          Payment agreement
          <input type="hidden" name="label_payment_agreement" value="Payment agreement" />
          <select name="field_payment_agreement" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue={paymentLabel(customer.default_payment_terms)}>
            {["Cash", "Pay in 7 days", "Pay in 14 days", "Pay in 30 days"].map((term) => (
              <option key={term}>{term}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Customer status
          <input type="hidden" name="label_customer_status" value="Customer status" />
          <select name="field_customer_status" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue={customer.active === false || customer.status === "archived" ? "Inactive" : "Active"}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          Price group
          <input type="hidden" name="label_price_group" value="Price group" />
          <select name="field_price_group" className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2" defaultValue="Standard">
            {["Standard", "Wholesale", "Retail", "Special customer"].map((term) => (
              <option key={term}>{term}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-3 lg:col-span-2">
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            <Save className="h-4 w-4" />
            Update customer
          </button>
          <Link href="/customers" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            Cancel
          </Link>
        </div>
      </PersistedForm>
    </div>
  );
}
