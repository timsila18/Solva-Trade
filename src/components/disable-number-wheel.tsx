"use client";

import { useEffect } from "react";

export function DisableNumberWheel() {
  useEffect(() => {
    const stopNumberWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "number") return;
      if (document.activeElement !== target) return;

      event.preventDefault();
    };

    document.addEventListener("wheel", stopNumberWheel, { capture: true, passive: false });
    return () => document.removeEventListener("wheel", stopNumberWheel, { capture: true });
  }, []);

  return null;
}
