"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBusinessId } from "@/lib/tenant";

function safeText(value: FormDataEntryValue | null, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

export async function completeProcessAction(formData: FormData) {
  const moduleName = safeText(formData.get("module"), "Solva Trade");
  const processName = safeText(formData.get("process"), "Business process");
  const documentName = safeText(formData.get("document"), processName);
  const intent = safeText(formData.get("intent"), "Completed");
  const returnTo = safeText(formData.get("returnTo"), "/dashboard");
  const next = safeText(formData.get("next"), "Open Dashboard");

  const params = new URLSearchParams({
    module: moduleName,
    process: processName,
    document: documentName,
    intent,
    returnTo,
    next,
  });

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const businessId =
      (await getActiveBusinessId()) ||
      (typeof user?.app_metadata?.active_business_id === "string" ? user.app_metadata.active_business_id : null);

    if (user && businessId) {
      const admin = createSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        business_id: businessId,
        user_id: user.id,
        action: intent,
        module: moduleName,
        entity_type: documentName,
        new_value: {
          process: processName,
          document: documentName,
          status: "posted",
          source: "workspace_submit",
        },
      });
    }
  } catch {
    // The user should still receive the generated document if audit logging is unavailable.
  }

  redirect(`/action-complete?${params.toString()}`);
}
