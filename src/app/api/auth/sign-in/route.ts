import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  return redirectTo(request, "/dashboard");
}
