"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the app in next-themes' ThemeProvider with our config:
 * - attribute=["class", "data-theme"] — sets BOTH `<html class="dark">`
 *   and `<html data-theme="dark">` so dark: Tailwind variants AND our
 *   [data-theme="..."] CSS blocks both fire correctly.
 * - defaultTheme="dark" — first-visit users get the dark theme
 * - enableSystem={false} — System option intentionally disabled.
 *   prefers-color-scheme reporting on macOS Auto / browser overrides
 *   was unreliable; light/dark only is the simpler floor for now.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute={["class", "data-theme"]}
      defaultTheme="dark"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  );
}
