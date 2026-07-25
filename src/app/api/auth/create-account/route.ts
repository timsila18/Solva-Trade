import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseEmail, parsePassword, redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

const fullNameSchema = z.string().trim().min(2);

function isExistingUserError(error: Error) {
  return /already|registered|exists|duplicate/i.test(error.message);
}

function accountCreationError(request: NextRequest, error: Error) {
  if (isExistingUserError(error)) {
    return redirectWithError(request, "/create-account", "That email already has an account. Sign in instead, or reset the password.");
  }

  return redirectWithError(request, "/create-account", "We could not create that account right now. Check the password and try again.");
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = parseEmail(formData);
  if (!email.success) return redirectWithError(request, "/create-account", "Enter a valid email address.");

  const password = parsePassword(formData);
  if (!password.success) return redirectWithError(request, "/create-account", "Password must be at least 8 characters.");

  const fullName = fullNameSchema.safeParse(formData.get("full_name"));
  if (!fullName.success) return redirectWithError(request, "/create-account", "Enter your full name.");

  const supabase = await createSupabaseServerClient();
  let signupError: Error | null = null;
  let usedAdminSignup = false;

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: email.data,
      password: password.data,
      email_confirm: true,
      user_metadata: { full_name: fullName.data },
    });
    signupError = error;
    usedAdminSignup = true;
  } catch {
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: { data: { full_name: fullName.data } },
    });
    signupError = error;
  }

  if (signupError) {
    return accountCreationError(request, signupError);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (signInError) {
    const message = usedAdminSignup
      ? "Your account was created, but automatic sign-in failed. Please sign in with the same email and password."
      : "Check your inbox to confirm your email, then sign in.";
    return redirectWithError(request, "/sign-in", message);
  }

  return redirectTo(request, "/onboarding");
}
