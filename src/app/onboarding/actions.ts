"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setActiveBusinessCookie } from "@/lib/tenant";

const onboardingSchema = z.object({
  legal_name: z.string().min(2),
  trading_name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  physical_address: z.string().optional(),
  county: z.string().optional(),
  country: z.string().default("Kenya"),
  kra_pin: z.string().optional(),
  default_currency: z.string().default("KES"),
  financial_year_start_month: z.coerce.number().int().min(1).max(12),
  stock_costing_method: z.enum(["weighted_average", "fifo"]),
  primary_brand_color: z.string().optional(),
});

export async function completeOnboardingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/sign-in");

  const values = onboardingSchema.parse({
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

  const { primary_brand_color, ...businessValues } = values;

  const { data: business, error } = await supabase
    .from("businesses")
    .insert({
      ...businessValues,
      onboarding_status: "complete",
      default_document_theme: { primaryBrandColor: primary_brand_color },
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: membershipError } = await supabase.from("business_memberships").insert({
    user_id: userData.user.id,
    business_id: business.id,
    role: "owner",
    joined_at: new Date().toISOString(),
  });
  if (membershipError) throw new Error(membershipError.message);

  await setActiveBusinessCookie(business.id);
  redirect("/dashboard");
}
