"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { applyThemeColor } from "@/lib/theme";

/** Keeps the <html> class in step with the theme setting, including live OS changes. */
export function ThemeSync() {
  const { profile, ready } = useStore();

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark =
        profile.theme === "dark" || (profile.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      // The browser's own chrome follows the app, not the OS.
      applyThemeColor(dark);
    };

    apply();
    if (profile.theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [profile.theme, ready]);

  return null;
}
