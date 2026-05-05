"use client";

import { usePathname } from "next/navigation";

/**
 * Suppresses the global Footer on admin routes.
 *
 * The Footer is mounted in the root layout below the children block,
 * which works fine for marketing/creator surfaces but collides with
 * the admin shell: the Sidebar's container is `position: fixed`
 * inset-y-0, so when a long admin page scrolls, the Footer slides
 * full-width into view and the leftmost ~16rem disappears under the
 * fixed rail.
 *
 * Admins already see a "Powered by" mark inside the sidebar footer,
 * and the marketing platform/legal/contact links aren't useful in
 * the admin tool, so we just hide the Footer entirely on /admin/*.
 *
 * The Footer itself is async (server component) and is passed in as
 * children — Next.js renders it on the server and we just decide
 * whether to mount the resulting tree on the client. Hiding via
 * `display: none` would still leave a layout slot on the page, so
 * we return `null` outright.
 */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}
