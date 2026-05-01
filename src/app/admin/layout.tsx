import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { getAccountType } from "@/lib/account";
import { AdminNav } from "./admin-nav";

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
        .select("is_platform_admin")
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

  return (
    <div className="flex min-h-screen">
      <AdminNav
        userId={user.id}
        isOrgAdmin={isOrgAdmin}
        isPlatformAdmin={isPlatformAdmin}
        org={{
          name: org.name,
          logoUrl: org.logo_url,
          accentColor: org.accent_color,
        }}
      />
      <main className="flex-1 md:ml-64">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
