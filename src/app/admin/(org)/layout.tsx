import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { getAccountType } from "@/lib/account";
import { AdminNav } from "./admin-nav";
import { SupportModeBanner } from "@/components/support-mode-banner";
import { PlatformNoticeBanner } from "@/components/platform-notice-banner";
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
  // This layout wraps the (org) route group only. /admin/super lives
  // in a sibling subtree (src/app/admin/super/) with its own layout,
  // so the URLs are routed through completely separate layout chains
  // and we don't need a runtime pathname guard here.
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Three account types route here:
  //   * org     , their own shell, normal admin/member gating
  //   * platform, only when scoped into an org via support mode;
  //                a platform admin without support_org_id is bounced
  //                from the dashboard route to /admin/super (handled
  //                by (org)/page.tsx)
  //   * creator , never; sent to /briefs
  const accountType = await getAccountType(supabase);
  if (accountType === "creator") redirect("/briefs");
  if (!accountType) redirect("/login");

  const isPlatformActor = accountType === "platform";

  // Resolve the org context. For org accounts this is the standard
  // active_org_id path. For platform admins it's support_org_id;
  // requireActiveOrg honors that via getActiveOrg, which reads
  // support_org_id when account_type='platform'.
  const orgId = isPlatformActor
    ? await (async () => {
        const { data } = await supabase
          .from("profiles")
          .select("support_org_id")
          .eq("id", user.id)
          .maybeSingle();
        return data?.support_org_id ?? null;
      })()
    : await requireActiveOrg(supabase);

  // Platform admin without a support session: render the children bare.
  // The dashboard route's page.tsx redirects them to /admin/super; for
  // any other (org) route they'd hit, we just skip the org shell so
  // we don't try to render AdminNav with no org context.
  if (!orgId) {
    return <>{children}</>;
  }

  // Resolve the data AdminNav needs server-side and pass it in as
  // props. For platform admins we synthesise an admin-equivalent
  // membership so the nav doesn't lock the admin-only rows.
  const [{ data: membership }, { data: profile }, { data: org }] =
    await Promise.all([
      isPlatformActor
        ? Promise.resolve({ data: { role: "admin" as const } })
        : supabase
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
    // The active (or support) org was deleted out from under us.
    redirect(isPlatformActor ? "/admin/super" : "/login");
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
        userEmail={user.email ?? ""}
        userName={profile?.name ?? null}
        userAvatarUrl={profile?.avatar_url ?? null}
        isOrgAdmin={isOrgAdmin}
        isPlatformAdmin={isPlatformAdmin}
        isSupportMode={isPlatformActor}
        org={{
          id: org.id,
          name: org.name,
          logoUrl: org.logo_url,
          accentColor: org.accent_color,
        }}
      />
      {/* `min-w-0` on the SidebarInset flex item is the load-bearing
          fix: shadcn's primitive defaults to `min-width: auto`, so a
          wide descendant (long brief title in a table) could push the
          inset past its share of the row and out of the viewport on
          the right. With min-w-0 the inset can shrink to its flex
          share regardless of content. */}
      <SidebarInset className="min-w-0">
        {/* Platform-wide and per-org notices stack above the support
            mode banner so a "site is read-only for the next 30 minutes"
            advisory shows even during a support session. */}
        <PlatformNoticeBanner />
        {isPlatformActor && (
          <SupportModeBanner
            org={{
              id: org.id,
              name: org.name,
              logoUrl: org.logo_url,
              accentColor: org.accent_color,
            }}
          />
        )}
        {/* Sidebar toggle lives inside AdminNav's SidebarHeader on
            desktop. On mobile the sidebar collapses to an off-canvas
            drawer with no visible trigger, so render a small fixed
            fallback that only appears below the md breakpoint. */}
        <SidebarTrigger className="md:hidden fixed top-3 left-3 z-40 bg-background/80 backdrop-blur-sm border border-border/60" />
        {/* `min-w-0` lets this flex child shrink below its content
            min, so a wide descendant (e.g. an unbreakable brief title
            in a table) scrolls within its own container instead of
            pushing the page wider than the viewport. */}
        <div className="min-w-0 p-6 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
