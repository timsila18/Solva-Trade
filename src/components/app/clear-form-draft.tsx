"use client";

import { useEffect } from "react";

export function ClearFormDraft({ draftKey }: { draftKey: string }) {
  useEffect(() => {
    if (!draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore storage failures; the submitted record is already safely posted.
    }
  }, [draftKey]);

  return null;
}
