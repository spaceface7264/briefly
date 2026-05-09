"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Check } from "lucide-react";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/**
 * Dropdown items for theme selection. Drop inside any existing
 * <DropdownMenuContent> — the wrapper renders a separator + label
 * above the three options so the section reads as a sub-group.
 *
 * Wraps in a mounted-gate to avoid hydration mismatch (next-themes
 * resolves the active theme client-side after mount).
 */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydration gate — intentional setState in effect so the active
    // checkmark only renders client-side once next-themes resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted font-medium">
          Theme
        </DropdownMenuLabel>
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className="flex items-center gap-2"
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="flex-1">{label}</span>
              {active && (
                <Check className="size-3.5 text-brand-ink" aria-hidden />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </>
  );
}
