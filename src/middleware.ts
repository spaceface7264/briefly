import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Kept as `middleware.ts` (not the Next 16 `proxy.ts`) because
// @opennextjs/cloudflare does not yet support the new proxy
// convention. The Cloudflare adapter only supports Edge middleware,
// while Next 16's proxy defaults to Node.js runtime and can't be
// reconfigured. Building with proxy.ts emits the runtime error
// "Node.js middleware is not currently supported." See:
//   https://github.com/opennextjs/opennextjs-cloudflare/issues/962
//   https://github.com/opennextjs/opennextjs-cloudflare/issues/972
//
// Next 16 emits a deprecation warning ("the 'middleware' file
// convention is deprecated") at build time. We accept the warning
// until OpenNext ships proxy support, then re-run
// `npx @next/codemod@canary middleware-to-proxy .` to flip back.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
