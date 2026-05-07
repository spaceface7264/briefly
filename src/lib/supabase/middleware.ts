import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const protectedPaths = ["/briefs", "/my-briefs", "/profile", "/admin"];
  const isProtectedPath = protectedPaths.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(path + "/")
  );
  const isLoginPath = request.nextUrl.pathname === "/login";

  // Sniff for any Supabase auth cookies. When present we always need
  // to walk the refresh path, even on public surfaces, so a stale or
  // revoked refresh token gets cleaned out here instead of leaking into
  // RootLayout / page server code where the throw surfaces as a
  // dev-overlay "Console AuthApiError".
  const hasAuthCookies = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-"));

  // Skip auth/session overhead on fully public, fully signed-out
  // requests. Anything else (protected route, login page, or any
  // request carrying sb-* cookies) goes through the full refresh +
  // recovery path below.
  if (!isProtectedPath && !isLoginPath && !hasAuthCookies) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed for protected pages, but keep public/login usable.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  let user: { id: string } | null = null;
  let authFailed = false;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    authFailed = true;
  }

  // Stale / revoked refresh token: nuke the sb-* cookies on the
  // response so the next request comes in clean and signed-out
  // instead of looping through another failed refresh. Uses the same
  // request.cookies snapshot Supabase saw, since auth-js may have
  // already half-mutated them via setAll.
  if (authFailed) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        supabaseResponse.cookies.delete(cookie.name);
      }
    }
    if (isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      // Carry the cookie deletions onto the redirect response so the
      // login page sees a clean cookie jar.
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) {
          response.cookies.delete(cookie.name);
        }
      }
      return response;
    }
    return supabaseResponse;
  }

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page
  if (isLoginPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/discover";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
