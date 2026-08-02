"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

type SavedForm = {
  fields: Record<string, string>;
  checks: Record<string, boolean>;
  savedAt: string;
};

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "onChange" | "onInput"> & {
  draftKey?: string;
  preserveHiddenFields?: boolean;
};

const SKIP_NAMES = new Set(["module", "process", "document", "intent", "returnTo", "next", "draftKey"]);

function shouldPersist(name: string) {
  return name && !SKIP_NAMES.has(name) && !name.startsWith("label_");
}

function readSaved(key: string): SavedForm | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedForm) : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, form: HTMLFormElement) {
  const fields: Record<string, string> = {};
  const checks: Record<string, boolean> = {};
  const elements = Array.from(form.elements);

  for (const element of elements) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    if (!shouldPersist(element.name)) continue;
    if (element instanceof HTMLInputElement && element.type === "file") continue;

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      checks[element.name] = element.checked;
      if (element.checked) fields[element.name] = element.value;
      continue;
    }

    fields[element.name] = element.value;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify({ fields, checks, savedAt: new Date().toISOString() }));
  } catch {
    // Browsers can deny storage in private modes; the form should still work.
  }
}

function restoreSaved(key: string, form: HTMLFormElement, preserveHiddenFields: boolean) {
  const saved = readSaved(key);
  if (!saved) return;

  const elements = Array.from(form.elements);
  for (const element of elements) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    if (!shouldPersist(element.name)) continue;
    if (element instanceof HTMLInputElement && element.type === "file") continue;
    if (!preserveHiddenFields && element instanceof HTMLInputElement && element.type === "hidden") continue;

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      if (Object.prototype.hasOwnProperty.call(saved.checks, element.name)) {
        element.checked = saved.checks[element.name];
      }
      continue;
    }

    const next = saved.fields[element.name];
    if (typeof next === "string") element.value = next;
  }

  window.dispatchEvent(new CustomEvent("solva:form-draft-restored", { detail: { draftKey: key, values: saved.fields, checks: saved.checks } }));
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("solva:form-draft-restored", { detail: { draftKey: key, values: saved.fields, checks: saved.checks } }));
  }, 0);
  form.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("change", { bubbles: true }));
}

export function PersistedForm({ draftKey, preserveHiddenFields = false, children, ...props }: Props) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const resolvedDraftKey = useMemo(() => draftKey || `solva-trade:form-draft:${pathname}`, [draftKey, pathname]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    restoreSaved(resolvedDraftKey, form, preserveHiddenFields);

    let timer: number | null = null;
    const save = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => writeSaved(resolvedDraftKey, form), 120);
    };

    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      if (timer) window.clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [preserveHiddenFields, resolvedDraftKey]);

  return (
    <form ref={formRef} {...props}>
      <input type="hidden" name="draftKey" value={resolvedDraftKey} />
      {children}
    </form>
  );
}
