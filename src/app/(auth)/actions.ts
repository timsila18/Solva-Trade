"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8);

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export async function createAccountAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));
  const fullName = z.string().min(2).parse(formData.get("full_name"));
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw new Error(error.message);
  redirect("/onboarding");
}

export async function forgotPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = emailSchema.parse(formData.get("email"));
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
  redirect("/sign-in");
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const password = passwordSchema.parse(formData.get("password"));
  const confirm = passwordSchema.parse(formData.get("confirm_password"));
  if (password !== confirm) throw new Error("Passwords do not match.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
