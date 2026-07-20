"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8);
const genericAuthError = "We could not complete that authentication request. Check the details and try again.";

function redirectWithError(path: string, message = genericAuthError): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseEmail(formData: FormData, path: string) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirectWithError(path, "Enter a valid email address.");
  return parsed.data;
}

function parsePassword(formData: FormData, path: string) {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) redirectWithError(path, "Password must be at least 8 characters.");
  return parsed.data;
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = parseEmail(formData, "/sign-in");
  const password = parsePassword(formData, "/sign-in");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirectWithError("/sign-in", "We could not sign you in. Check your email and password.");
  redirect("/dashboard");
}

export async function createAccountAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = parseEmail(formData, "/create-account");
  const password = parsePassword(formData, "/create-account");
  const fullNameResult = z.string().min(2).safeParse(formData.get("full_name"));
  if (!fullNameResult.success) redirectWithError("/create-account", "Enter your full name.");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullNameResult.data } },
  });
  if (error) redirectWithError("/create-account", "We could not create that account. Try another email or password.");
  redirect("/onboarding");
}

export async function forgotPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = parseEmail(formData, "/forgot-password");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) redirect("/forgot-password?message=If the email can receive resets, instructions will be sent.");
  redirect("/sign-in?message=If the email can receive resets, instructions will be sent.");
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const password = parsePassword(formData, "/reset-password");
  const confirm = passwordSchema.safeParse(formData.get("confirm_password"));
  if (!confirm.success) redirectWithError("/reset-password", "Confirm your new password.");
  if (password !== confirm.data) redirectWithError("/reset-password", "Passwords do not match.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirectWithError("/reset-password");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
