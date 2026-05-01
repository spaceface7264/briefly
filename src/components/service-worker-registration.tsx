"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Avoid registering in dev — Next's HMR fights the SW cache and
    // makes "why won't my edit show up" debugging miserable.
    if (process.env.NODE_ENV !== "production") return;

    function register() {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Registration can fail behind certain proxies or in
          // private-mode browsers. Not actionable client-side; the
          // app still works without the SW.
        });
    }

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
