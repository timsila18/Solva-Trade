"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

const createTeamUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["owner", "manager", "staff"]),
  staff_template: z.string().optional(),
});

export async function createTeamUserAction(formData: FormData) {
  const values = createTeamUserSchema.parse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    staff_template: formData.get("staff_template") || undefined,
  });

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Sign in before creating a team user.");
  }

  let businessId = await getActiveBusinessId();
  if (!businessId) {
    const { data: membership } = await supabase
      .from("business_memberships")
      .select("business_id")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    businessId = membership?.business_id ?? null;
  }

  if (!businessId) {
    throw new Error("Choose a business before creating a team user.");
  }

  const { data: ownerMembership } = await supabase
    .from("business_memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (ownerMembership?.role !== "owner") {
    throw new Error("Only a business Owner can create team users.");
  }

  const admin = createSupabaseAdminClient();
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
    user_metadata: { full_name: values.full_name },
  });

  if (createError || !createdUser.user) {
    throw new Error("We could not create that user. Check whether the email already exists.");
  }

  const userId = createdUser.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: values.full_name,
    email: values.email,
    active: true,
  });
  if (profileError) throw new Error("The user was created, but their profile could not be prepared.");

  const { data: existingMembership } = await admin
    .from("business_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("active", true)
    .maybeSingle();

  const membershipPayload = {
      user_id: userId,
      business_id: businessId,
      role: values.role,
      staff_template: values.staff_template,
      invitation_status: "accepted",
      joined_at: new Date().toISOString(),
      invited_by: userData.user.id,
      active: true,
  };

  const { error: membershipError } = existingMembership
    ? await admin
        .from("business_memberships")
        .update({
          role: values.role,
          staff_template: values.staff_template,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id)
    : await admin.from("business_memberships").insert(membershipPayload);

  if (membershipError) throw new Error("The user was created, but business access could not be assigned.");

  await admin.from("audit_logs").insert({
    business_id: businessId,
    user_id: userData.user.id,
    action: "team.user_created",
    module: "administration",
    entity_type: "profile",
    entity_id: userId,
    new_value: { email: values.email, role: values.role, staffTemplate: values.staff_template },
  });

  revalidatePath("/team");
}
