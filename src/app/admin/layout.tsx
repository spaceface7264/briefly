import { cookies, headers } from "next/headers";
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
  // /admin/super has its own platform shell with a different sidebar.
  // Hand children through bare so the platform layout doesn't render
  // inside the org admin sidebar. Pathname comes from middleware via
  // x-pathname; Next 16 does not expose it server-side otherwise.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  if (pathname.startsWith("/admin/super")) {
    return <>{children}</>;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Three account types route here:
  //   * org     , their own shell, normal admin/member gating
  //   * platform, only when scoped into an org via support mode;
  //                a platform admin without support_org_id is allowed
  //                through to /admin/super (handled by its own gate)
  //                or bounced from the org dashboard to /admin/super
  //                (handled by /admin/page.tsx)
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
  // /admin/super has its own platform shell layout; /admin (the
  // dashboard root) bounces to /admin/super from inside its own
  // page.tsx, so we don't redirect here, that would loop on
  // /admin/super itself, since this layout wraps both.
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
        userId={user.id}
        userEmail={user.email ?? ""}
        userName={profile?.name ?? null}
        userAvatarUrl={profile?.avatar_url ?? null}
        isOrgAdmin={isOrgAdmin}
        isPlatformAdmin={isPlatformAdmin}
        isSupportMode={isPlatformActor}
        org={{
          name: org.name,
          logoUrl: org.logo_url,
          accentColor: org.accent_color,
        }}
      />
      <SidebarInset>
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
