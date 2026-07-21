import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseEmail, parsePassword, redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

const fullNameSchema = z.string().trim().min(2);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = parseEmail(formData);
  if (!email.success) return redirectWithError(request, "/create-account", "Enter a valid email address.");

  const password = parsePassword(formData);
  if (!password.success) return redirectWithError(request, "/create-account", "Password must be at least 8 characters.");

  const fullName = fullNameSchema.safeParse(formData.get("full_name"));
  if (!fullName.success) return redirectWithError(request, "/create-account", "Enter your full name.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: { data: { full_name: fullName.data } },
  });

  if (error) {
    return redirectWithError(request, "/create-account", "We could not create that account. Try another email or password.");
  }

  return redirectTo(request, "/onboarding");
}
