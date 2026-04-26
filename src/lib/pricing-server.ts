import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Guard for server actions and routes that should only run for
 * platform-level admins (manage plans, grant overrides, view revenue).
 *
 * Lives in its own file so client components can import the pure
 * helpers from `@/lib/pricing` without pulling the server-only
 * `createClient` into the client bundle.
 */
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_platform_admin) {
    return { ok: false as const, error: "Platform admin access required" };
  }
  return { ok: true as const, supabase, userId: user.id };
}
