import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePassword, redirectTo, redirectWithError } from "@/lib/auth/route-helpers";

const confirmSchema = z.string().min(8);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = parsePassword(formData);
  if (!password.success) return redirectWithError(request, "/reset-password", "Password must be at least 8 characters.");

  const confirm = confirmSchema.safeParse(formData.get("confirm_password"));
  if (!confirm.success) return redirectWithError(request, "/reset-password", "Confirm your new password.");
  if (password.data !== confirm.data) return redirectWithError(request, "/reset-password", "Passwords do not match.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return redirectWithError(request, "/reset-password", "We could not complete that authentication request. Check the details and try again.");

  return redirectTo(request, "/dashboard");
}
