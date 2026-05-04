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
 * `?flash=<key>` (plus any per-flash detail params), the destination
 * renders <FlashToast />, and the effect below fires the matching
 * toast once and then strips ALL flash-related params via
 * `router.replace` so a refresh doesn't re-toast.
 *
 * Drop new entries into FLASH_MESSAGES rather than writing custom
 * effects per page. Each entry is a factory that receives the live
 * search params so it can pull dynamic detail (e.g. `title`).
 */
type FlashMessage = {
  title: string;
  description?: string;
  tone: "success" | "info";
};

// Truncate a user-supplied display string for toast layout. Keeps
// long brief titles from blowing out the toast width.
function ellipsize(value: string, max = 80): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

const FLASH_MESSAGES: Record<
  string,
  (params: URLSearchParams) => FlashMessage
> = {
  "brief-published": (params) => {
    const title = ellipsize(params.get("title") ?? "");
    return {
      title: "Brief published",
      description: title || "Escrow charged. Creators can now claim.",
      tone: "success",
    };
  },
};

// Search-param keys consumed by FLASH_MESSAGES factories. Listed
// once so the cleanup step below strips them all in one pass — keeps
// stale `title=...` etc. out of the URL after the toast fires.
const FLASH_DETAIL_PARAMS = ["title"] as const;

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

    const factory = FLASH_MESSAGES[flash];
    if (factory) {
      const msg = factory(params);
      const fn = msg.tone === "success" ? toast.success : toast.info;
      fn(msg.title, msg.description ? { description: msg.description } : undefined);
    }

    const next = new URLSearchParams(params.toString());
    next.delete("flash");
    for (const key of FLASH_DETAIL_PARAMS) next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [flash, params, pathname, router]);

  return null;
}
