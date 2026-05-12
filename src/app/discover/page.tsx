import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getAccountType } from "@/lib/account";
import { OrgCard } from "./org-card";

export default async function DiscoverPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const accountType = await getAccountType(supabase);
  const isOrgUser = accountType === "org";

  // First-time creators get walked through onboarding before they can
  // browse orgs. /discover is otherwise accessible to anyone (incl.
  // anonymous and org users), so we only gate the creator branch.
  if (user && accountType === "creator") {
    const { data } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!(data as { onboarded_at?: string | null } | null)?.onboarded_at) {
      redirect("/onboarding");
    }
  }

  // Get all discoverable orgs
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, slug, name, logo_url, description, industry, accent_color")
    .eq("discoverable", true)
    .order("name", { ascending: true });

  // Get user's existing memberships and applications
  let memberOrgIds: string[] = [];
  let applications: Record<string, string> = {};

  if (user) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    memberOrgIds = (memberships || []).map((m) => m.org_id);

    const { data: apps } = await supabase
      .from("org_applications")
      .select("org_id, status")
      .eq("user_id", user.id);

    for (const app of apps || []) {
      applications[app.org_id] = app.status;
    }
  }

  // Count open briefs per org
  const orgBriefCounts: Record<string, number> = {};
  if (orgs && orgs.length > 0) {
    for (const org of orgs) {
      const { count } = await supabase
        .from("briefs")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "open");
      orgBriefCounts[org.id] = count || 0;
    }
  }

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="font-display tracking-tight text-3xl font-bold mb-2">
              {isOrgUser ? "Other brands" : "Discover"}
            </h1>
            <p className="text-muted">
              {isOrgUser
                ? "See what other brands on the platform are publishing."
                : "Browse businesses and apply to join their creator roster."}
            </p>
          </div>

          {orgs && orgs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  openBriefs={orgBriefCounts[org.id] || 0}
                  isMember={memberOrgIds.includes(org.id)}
                  applicationStatus={applications[org.id] || null}
                  isAuthenticated={!!user}
                  canApply={!isOrgUser}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted text-lg">
                No businesses are listed yet. Check back soon.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
