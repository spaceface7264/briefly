"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standalone theme toggle — Sun/Moon icon button that flips between
 * light and dark on click. Used in nav contexts without an existing
 * dropdown (logged-out home, org-user transit nav). The Light/Dark
 * options live inside the dropdowns elsewhere via ThemeMenuItems.
 *
 * The icon swap (Sun fades out + Moon fades in) is driven by Tailwind
 * dark: variants which fire when `<html data-theme="dark">`.
 */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydration gate — resolvedTheme is undefined on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={mounted ? `Switch to ${next} theme` : "Toggle theme"}
      onClick={() => setTheme(next)}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "relative",
      )}
    >
      <Sun className="size-[1.05rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[1.05rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
