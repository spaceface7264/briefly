"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * One-shot toast trigger driven by the URL.
 *
 * Server actions that resolve via `redirect()` throw NEXT_REDIRECT
 * before the calling client component ever resumes, so the usual
 * `toast.success(...)` after `await action()` never fires. This
 * component bridges that gap: the action redirects to a URL with
 * `?flash=<key>`, the destination renders <FlashToast />, and the
 * effect below fires the matching toast once and then strips the
 * param via `router.replace` so a refresh doesn't re-toast.
 *
 * Drop new entries into FLASH_MESSAGES rather than writing custom
 * effects per page.
 */
const FLASH_MESSAGES: Record<
  string,
  { title: string; description?: string; tone: "success" | "info" }
> = {
  "brief-published": {
    title: "Brief published",
    description: "Escrow charged. Creators can now claim.",
    tone: "success",
  },
};

export function FlashToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const flash = params.get("flash");
  // Guard against React StrictMode double-invocation in dev: fire
  // for each unique flash value at most once per mount.
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    if (firedRef.current === flash) return;
    firedRef.current = flash;

    const msg = FLASH_MESSAGES[flash];
    if (msg) {
      const fn = msg.tone === "success" ? toast.success : toast.info;
      fn(msg.title, msg.description ? { description: msg.description } : undefined);
    }

    const next = new URLSearchParams(params.toString());
    next.delete("flash");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [flash, params, pathname, router]);

  return null;
}
