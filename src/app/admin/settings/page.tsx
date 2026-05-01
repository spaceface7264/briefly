import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { NotificationsPanel } from "@/components/notifications-panel";
import { preferencesFromProfile } from "@/lib/notifications";
import { AdminTeam } from "./admin-team";
import { PersonalAccountForm } from "./personal-account-form";
import {
  TeamInvites,
  type TeammateInvite,
  type RedeemedInvite,
} from "./team-invites";

export const dynamic = "force-dynamic";

type SettingsTab = "personal" | "team" | "notifications";

const TABS: { id: SettingsTab; label: string; description: string }[] = [
  {
    id: "personal",
    label: "Personal",
    description: "Your name, email, and password.",
  },
  {
    id: "team",
    label: "Team",
    description: "Your teammates and pending invites.",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email alerts you receive from your org.",
  },
];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab: SettingsTab =
    params.tab === "team" || params.tab === "notifications"
      ? params.tab
      : "personal";
  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);

  // Settings is the personal-and-team surface — org identity / branding /
  // discoverability live on /admin/organization. We only need the org's
  // display name here so the personal form can read "Member at <Org>".
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const [
    { data: adminMemberships },
    { data: memberMemberships },
    { data: creatorMemberships },
    { data: me },
    { data: myMembership },
    { data: teammateInvitesRaw },
    { data: redeemedInvitesRaw },
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
      .select(
        "user_id, profile:profiles(id, name, email, created_at, notify_submissions)"
      )
      .eq("org_id", orgId)
      .eq("role", "member")
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
    // Recently redeemed teammate invites — surfaced underneath the active
    // table so admins can see "who joined via which code" without losing
    // the actionable list above. Capped at 20 most recent by used_at.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("invite_codes") as any)
      .select(
        "id, code, role, used_at, used_by, intended_account_type, used_by_profile:profiles!invite_codes_used_by_fkey(name, email)"
      )
      .eq("org_id", orgId)
      .eq("intended_account_type", "org")
      .not("used_by", "is", null)
      .order("used_at", { ascending: false })
      .limit(20),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admins = (adminMemberships || []).map((m: any) => m.profile).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (memberMemberships || []).map((m: any) => m.profile).filter(Boolean);
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

  const redeemedInvites: RedeemedInvite[] = (redeemedInvitesRaw ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (invite: any) => ({
      id: invite.id,
      code: invite.code,
      role: invite.role,
      used_at: invite.used_at,
      redeemed_by_name: invite.used_by_profile?.name ?? null,
      redeemed_by_email: invite.used_by_profile?.email ?? null,
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted">{activeTabMeta.description}</p>
      </div>

      {/* Tab strip. Search-param state (?tab=team, ?tab=notifications)
          so each tab is linkable and survives refresh. Default tab
          omits the param entirely to keep the canonical URL clean. */}
      <div className="mb-8 border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Settings sections">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const href =
              tab.id === "personal"
                ? "/admin/settings"
                : `/admin/settings?tab=${tab.id}`;
            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {activeTab === "personal" && (
        <div className="space-y-10">
          <PersonalAccountForm
            initialName={me?.name ?? ""}
            email={user.email ?? ""}
            roleLabel={roleLabel}
            orgName={org?.name ?? "your org"}
          />
        </div>
      )}

      {activeTab === "team" && (
        <div className="space-y-10">
          <AdminTeam
            admins={admins ?? []}
            members={members ?? []}
            creators={creators ?? []}
            orgName={org?.name ?? "Your"}
            currentUserId={user.id}
            canManage={isAdmin}
          />

          <TeamInvites
            invites={teammateInvites}
            redeemedInvites={redeemedInvites}
            canManage={isAdmin}
          />
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-10">
          <NotificationsPanel
            audience="org"
            preferences={myPreferences}
            warningsByType={{ submissions: submissionsWarning }}
          />
        </div>
      )}
    </div>
  );
}
