import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setActiveBusinessCookie } from "@/lib/tenant";
import { redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

const onboardingSchema = z.object({
  legal_name: z.string().trim().min(2),
  trading_name: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  physical_address: z.string().trim().optional(),
  county: z.string().trim().optional(),
  country: z.string().trim().default("Kenya"),
  kra_pin: z.string().trim().optional(),
  default_currency: z.string().trim().default("KES"),
  financial_year_start_month: z.coerce.number().int().min(1).max(12),
  stock_costing_method: z.enum(["weighted_average", "fifo"]),
  primary_brand_color: z.string().trim().optional(),
});

function cleanOptional(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return redirectTo(request, "/sign-in");

  const formData = await request.formData();
  const values = onboardingSchema.safeParse({
    legal_name: formData.get("legal_name"),
    trading_name: formData.get("trading_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    physical_address: formData.get("physical_address"),
    county: formData.get("county"),
    country: formData.get("country") || "Kenya",
    kra_pin: formData.get("kra_pin"),
    default_currency: formData.get("default_currency") || "KES",
    financial_year_start_month: formData.get("financial_year_start_month") || "1",
    stock_costing_method: formData.get("stock_costing_method") || "weighted_average",
    primary_brand_color: formData.get("primary_brand_color"),
  });

  if (!values.success) {
    return redirectWithError(request, "/onboarding", "Complete the required business details before saving.");
  }

  const admin = createSupabaseAdminClient();
  const user = userData.user;
  await admin.from("profiles").upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Solva Trade user",
    email: user.email ?? values.data.email ?? "",
    updated_at: new Date().toISOString(),
  });

  const { data: existingMembership, error: membershipLookupError } = await admin
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipLookupError) {
    return redirectWithError(request, "/onboarding", "We could not check your workspace access. Please try again.");
  }

  const { primary_brand_color, ...businessValues } = values.data;
  const payload = {
    ...businessValues,
    phone: cleanOptional(businessValues.phone),
    email: cleanOptional(businessValues.email),
    physical_address: cleanOptional(businessValues.physical_address),
    county: cleanOptional(businessValues.county),
    kra_pin: cleanOptional(businessValues.kra_pin),
    country: businessValues.country || "Kenya",
    default_currency: businessValues.default_currency || "KES",
    onboarding_status: "complete",
    lifecycle_status: "trial",
    onboarding_owner_id: user.id,
    default_document_theme: { primaryBrandColor: primary_brand_color },
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const businessResult = existingMembership?.business_id
    ? await admin.from("businesses").update(payload).eq("id", existingMembership.business_id).select("id").single()
    : await admin.from("businesses").insert(payload).select("id").single();

  if (businessResult.error || !businessResult.data) {
    return redirectWithError(request, "/onboarding", "We could not save the business workspace. Please try again.");
  }

  const businessId = businessResult.data.id;
  if (!existingMembership?.business_id) {
    const { error: insertMembershipError } = await admin.from("business_memberships").insert({
      user_id: user.id,
      business_id: businessId,
      role: "owner",
      joined_at: new Date().toISOString(),
      active: true,
    });

    if (insertMembershipError) {
      return redirectWithError(request, "/onboarding", "The workspace was saved, but access could not be assigned. Please contact support.");
    }
  }

  await setActiveBusinessCookie(businessId);
  return redirectTo(request, "/dashboard");
}
