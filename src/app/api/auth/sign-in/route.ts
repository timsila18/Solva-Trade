import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setActiveBusinessCookie } from "@/lib/tenant";
import { parseEmail, parsePassword, redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = parseEmail(formData);
  if (!email.success) return redirectWithError(request, "/sign-in", "Enter a valid email address.");

  const password = parsePassword(formData);
  if (!password.success) return redirectWithError(request, "/sign-in", "Password must be at least 8 characters.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
    return redirectWithError(request, "/sign-in", "We could not sign you in. Check your email and password.");
  }

  const { data: memberships } = await supabase
    .from("business_memberships")
    .select("business_id, businesses(onboarding_status)")
    .eq("active", true)
    .limit(1);
  const membership = memberships?.[0];
  if (!membership?.business_id) {
    const { data: userData } = await supabase.auth.getUser();
    const admin = createSupabaseAdminClient();
    const { data: platformUser } = userData.user
      ? await admin
          .from("platform_users")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (platformUser?.id) return redirectTo(request, "/dashboard");
    return redirectTo(request, "/onboarding");
  }

  await setActiveBusinessCookie(membership.business_id);
  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
  if (business?.onboarding_status !== "complete") return redirectTo(request, "/onboarding");

  return redirectTo(request, "/dashboard");
}
