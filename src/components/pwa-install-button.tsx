"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallState = "checking" | "ready" | "installed" | "manual";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function subscribeStandalone(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export function PwaInstallButton({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>("checking");
  const [showHelp, setShowHelp] = useState(false);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setState("ready");
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setState("installed");
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    const fallback = window.setTimeout(() => {
      setState((current) => current === "checking" ? "manual" : current);
    }, 1200);

    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setShowHelp((value) => !value);
      setState((current) => current === "checking" ? "manual" : current);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setState("installed");
        setInstallPrompt(null);
        setShowHelp(false);
        return;
      }
    } catch {
      // Browser install support must never interrupt the business workspace.
    }
    setInstallPrompt(null);
    setState("manual");
    setShowHelp(true);
  }

  const isDark = variant === "dark";
  const buttonClass = isDark
    ? "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-cyan-200/25 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/15"
    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-500 hover:text-slate-950";
  const helpClass = isDark
    ? "mt-2 max-w-xs rounded-md border border-cyan-200/20 bg-white/10 px-3 py-2 text-xs leading-5 text-cyan-50"
    : "mt-2 max-w-xs rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-900";

  if (state === "installed" || standalone) {
    return (
      <span className={buttonClass} aria-label="Solva Trade app is installed">
        <Smartphone className="h-4 w-4" />
        App installed
      </span>
    );
  }

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={installApp} className={buttonClass}>
        <Download className="h-4 w-4" />
        Download app
      </button>
      {showHelp ? (
        <p className={helpClass}>
          If the install prompt does not open, use your browser menu and choose Install app or Add to Home Screen.
        </p>
      ) : null}
    </div>
  );
}
