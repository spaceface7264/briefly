import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { NotificationsPanel } from "@/components/notifications-panel";
import { preferencesFromProfile } from "@/lib/notifications";
import { AdminTeam } from "./admin-team";
import { DiscoverabilityToggle } from "./discoverability-toggle";
import { OrgDetailsForm } from "./org-details-form";
import { OrgDetailsView } from "./org-details-view";
import { PersonalAccountForm } from "./personal-account-form";
import { TeamInvites, type TeammateInvite } from "./team-invites";

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
    { data: teammateInvitesRaw },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("invite_codes") as any)
      .select(
        "id, code, role, created_at, expires_at, used_by, intended_account_type, created_by_profile:profiles!invite_codes_created_by_fkey(name, email)"
      )
      .eq("org_id", orgId)
      .eq("intended_account_type", "org")
      .is("used_by", null)
      .order("created_at", { ascending: false }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admins = (adminMemberships || []).map((m: any) => m.profile).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creators = (creatorMemberships || []).map((m: any) => m.profile).filter(Boolean);

  // Single source of truth for "can this user mutate org-level settings?"
  // Server actions enforce the same check via `requireOrgAdmin()`; this
  // flag is for UI gating so members see read-only views instead of
  // editable forms that fail on submit.
  const isAdmin = myMembership?.role === "admin";
  // Server component runs once per request — `Date.now()` here is a
  // deliberate, single-call snapshot used to derive `is_expired` so the
  // client component can stay pure. The lint rule about purity targets
  // client components.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const teammateInvites: TeammateInvite[] = (teammateInvitesRaw ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (invite: any) => ({
      id: invite.id,
      code: invite.code,
      role: invite.role,
      created_at: invite.created_at,
      expires_at: invite.expires_at,
      created_by_email: invite.created_by_profile?.email ?? null,
      created_by_name: invite.created_by_profile?.name ?? null,
      is_expired: invite.expires_at
        ? new Date(invite.expires_at).getTime() <= nowMs
        : false,
    })
  );

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

        {org &&
          (isAdmin ? (
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
          ) : (
            <OrgDetailsView
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
          ))}

        <AdminTeam
          admins={admins ?? []}
          creators={creators ?? []}
          currentUserId={user.id}
          canManage={isAdmin}
        />

        <TeamInvites invites={teammateInvites} canManage={isAdmin} />

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
          canManage={isAdmin}
        />
      </div>
    </div>
  );
}
