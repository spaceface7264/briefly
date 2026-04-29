import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { NotificationsPanel } from "@/components/notifications-panel";
import { preferencesFromProfile } from "@/lib/notifications";
import { AdminTeam } from "./admin-team";
import { DiscoverabilityToggle } from "./discoverability-toggle";
import { OrgDetailsForm } from "./org-details-form";
import { PersonalAccountForm } from "./personal-account-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, slug, description, discoverable, industry, logo_url, accent_color, contact_email, address, cvr, vat_number"
    )
    .eq("id", orgId)
    .single();

  const [
    { data: adminMemberships },
    { data: creatorMemberships },
    { data: me },
    { data: myMembership },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "user_id, profile:profiles(id, name, email, created_at, notify_submissions)"
      )
      .eq("org_id", orgId)
      .eq("role", "admin")
      .eq("status", "active"),
    supabase
      .from("memberships")
      .select("user_id, profile:profiles(id, name, email, created_at)")
      .eq("org_id", orgId)
      .eq("role", "creator")
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select(
        "name, notify_submissions, notify_new_briefs, notify_claim_updates, notify_claim_queue, notify_payments, notify_applications"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admins = (adminMemberships || []).map((m: any) => m.profile).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creators = (creatorMemberships || []).map((m: any) => m.profile).filter(Boolean);

  const myPreferences = preferencesFromProfile(me ?? {});

  // Coverage: how many admins *other than* the signed-in user currently
  // have submission alerts enabled? If this drops to zero and the user
  // is about to turn theirs off, warn them — no one would be notified.
  const otherAdminsWithSubmissionAlerts = (admins ?? []).filter(
    (a) => a.id !== user.id && a.notify_submissions
  ).length;

  const submissionsWarning =
    otherAdminsWithSubmissionAlerts === 0 && (admins?.length ?? 0) > 0 ? (
      <>
        You&apos;re the only admin receiving submission alerts. If you turn
        this off, no one will be notified when creators submit work.
      </>
    ) : undefined;

  const myRole = myMembership?.role ?? "member";
  const roleLabel = myRole === "admin" ? "Admin" : "Member";

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted">
          Your personal account, your org, your team, and your email
          notifications.
        </p>
      </div>

      <div className="space-y-10">
        <PersonalAccountForm
          initialName={me?.name ?? ""}
          email={user.email ?? ""}
          roleLabel={roleLabel}
          orgName={org?.name ?? "your org"}
        />

        {org && (
          <OrgDetailsForm
            org={{
              name: org.name,
              slug: org.slug,
              description: org.description,
              industry: org.industry,
              logo_url: org.logo_url,
              accent_color: org.accent_color,
              contact_email: org.contact_email,
              address: org.address,
              cvr: org.cvr,
              vat_number: org.vat_number,
            }}
          />
        )}

        <AdminTeam
          admins={admins ?? []}
          creators={creators ?? []}
          currentUserId={user.id}
        />

        <NotificationsPanel
          audience="org"
          preferences={myPreferences}
          warningsByType={{ submissions: submissionsWarning }}
        />

        <DiscoverabilityToggle
          orgId={orgId}
          discoverable={org?.discoverable ?? false}
          orgName={org?.name ?? ""}
          orgDescription={org?.description ?? ""}
        />
      </div>
    </div>
  );
}
