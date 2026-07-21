import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseEmail, redirectWithError, redirectWithMessage } from "@/lib/auth/route-helpers";

const resetMessage = "If the email can receive resets, instructions will be sent.";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = parseEmail(formData);
  if (!email.success) return redirectWithError(request, "/forgot-password", "Enter a valid email address.");

  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) return redirectWithMessage(request, "/forgot-password", resetMessage);

  return redirectWithMessage(request, "/sign-in", resetMessage);
}
