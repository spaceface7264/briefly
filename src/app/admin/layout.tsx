import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { getAccountType } from "@/lib/account";
import { AdminNav } from "./admin-nav";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Org-only surface. Creator accounts get bounced to their shell.
  const accountType = await getAccountType(supabase);
  if (accountType !== "org") {
    redirect("/briefs");
  }

  // Org accounts are always tied to exactly one org. Admins and members
  // both land here; member-vs-admin gating is enforced inside the
  // sub-pages and server actions that need it (billing, settings, team).
  const orgId = await requireActiveOrg(supabase);

  // Resolve the data AdminNav needs server-side and pass it in as
  // props. Client-side bootstrap of these used to cause a brief flash
  // where Invites/Billing rendered as unlocked links before the effect
  // resolved and re-rendered them as locked buttons. By resolving here
  // we render the correct initial HTML, including the org's branding
  // anchor in the top-left of the sidebar.
  const [{ data: membership }, { data: profile }, { data: org }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .eq("status", "active")
        .single(),
      supabase
        .from("profiles")
        .select("name, is_platform_admin, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("id, name, logo_url, accent_color")
        .eq("id", orgId)
        .single(),
    ]);

  if (
    !membership ||
    (membership.role !== "admin" && membership.role !== "member")
  ) {
    redirect("/login");
  }

  if (!org) {
    // The active org was deleted out from under the membership row.
    // Bounce to login so the post-login redirector can decide whether
    // to surface the "this org is no longer on this platform" state.
    redirect("/login");
  }

  const isOrgAdmin = membership.role === "admin";
  const isPlatformAdmin = profile?.is_platform_admin === true;

  // Read the persisted sidebar state from the cookie set by
  // SidebarProvider (`sidebar_state`) so the SSR pass renders with
  // the same expanded/collapsed mode the user last picked. Avoids a
  // one-frame flash where the sidebar pops in collapsed and then
  // re-expands once the client mounts.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminNav
        userId={user.id}
        userEmail={user.email ?? ""}
        userName={profile?.name ?? null}
        userAvatarUrl={profile?.avatar_url ?? null}
        isOrgAdmin={isOrgAdmin}
        isPlatformAdmin={isPlatformAdmin}
        org={{
          name: org.name,
          logoUrl: org.logo_url,
          accentColor: org.accent_color,
        }}
      />
      <SidebarInset>
        {/* Compact page-shell header that hosts the sidebar toggle.
            On desktop it lets the user collapse the nav to icons; on
            mobile it's the only way to open the off-canvas drawer. */}
        <header className="flex h-12 items-center gap-2 px-4 md:px-6 border-b border-border/60 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <SidebarTrigger />
        </header>
        <div className="p-6 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
