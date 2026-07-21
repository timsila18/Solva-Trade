"use server";

import { redirect } from "next/navigation";

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

  redirect(`/action-complete?${params.toString()}`);
}
