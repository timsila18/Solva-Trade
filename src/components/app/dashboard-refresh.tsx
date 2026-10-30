"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DashboardRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 10000 || document.activeElement?.matches("input, select, textarea")) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return null;
}
