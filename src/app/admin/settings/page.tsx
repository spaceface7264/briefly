import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import {
  platformDetails,
  SELF_BILLING_AGREEMENT_VERSION,
} from "@/lib/invoicing/platform";
import { DK_STANDARD_VAT_RATE_BP } from "@/lib/invoicing/vat";
import { NotificationsPanel } from "@/components/notifications-panel";
import { StatusPill } from "@/components/status-pill";
import { preferencesFromProfile } from "@/lib/notifications";
import { AdminTeam } from "./admin-team";
import { DiscoverabilityToggle } from "./discoverability-toggle";
import { OrgDetailsForm } from "./org-details-form";
import { TeamInvites, type TeammateInvite } from "./team-invites";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);

  // Fetch org details
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, slug, description, discoverable, industry, logo_url, accent_color, contact_email, address, cvr, vat_number"
    )
    .eq("id", orgId)
    .single();

  // Fetch admins and creators via memberships for this org
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
        "notify_submissions, notify_new_briefs, notify_claim_updates, notify_claim_queue, notify_payments, notify_applications"
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

  const canManageTeam = myMembership?.role === "admin";
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

  const platform = platformDetails();
  const contactEmailFromEnv = Boolean(process.env.NEXT_PUBLIC_CONTACT_EMAIL);

  const platformRows: PlatformRow[] = [
    {
      label: "Company name",
      value: platform.name,
      env: "NEXT_PUBLIC_PLATFORM_NAME",
      isSet: Boolean(process.env.NEXT_PUBLIC_PLATFORM_NAME || process.env.PLATFORM_NAME),
    },
    {
      label: "Logo URL",
      value: platform.logoUrl,
      env: "NEXT_PUBLIC_LOGO_URL",
      isSet: Boolean(process.env.NEXT_PUBLIC_LOGO_URL),
    },
    {
      label: "Contact email",
      value: platform.contactEmail,
      env: "NEXT_PUBLIC_CONTACT_EMAIL",
      isSet: contactEmailFromEnv,
    },
    {
      label: "Address",
      value: platform.address,
      env: "PLATFORM_ADDRESS",
      isSet: Boolean(process.env.PLATFORM_ADDRESS),
    },
    {
      label: "CVR",
      value: platform.cvr,
      env: "PLATFORM_CVR",
      isSet: Boolean(process.env.PLATFORM_CVR),
    },
    {
      label: "VAT number",
      value: platform.vatNumber,
      env: "PLATFORM_VAT_NUMBER",
      isSet: Boolean(process.env.PLATFORM_VAT_NUMBER),
    },
  ];

  const constantRows: ConstantRow[] = [
    {
      label: "Claim expiry window",
      value: "7 days",
      note: "Set at claim time in brief-detail-client.tsx",
    },
    {
      label: "Default claim limit",
      value: "1 slot per brief",
      note: "Column default on briefs.claim_limit — editable per brief",
    },
    {
      label: "Self-billing agreement",
      value: SELF_BILLING_AGREEMENT_VERSION,
      note: "Creators re-accept when the version string changes",
    },
    {
      label: "Danish VAT rate",
      value: `${(DK_STANDARD_VAT_RATE_BP / 100).toFixed(1)} %`,
      note: "Applied to invoices when the creator is VAT-registered",
    },
    {
      label: "Invoice number format",
      value: "YYYY-00000",
      note: "Zero-padded sequence per calendar year",
    },
    {
      label: "Currency",
      value: "DKK",
      note: "All prices and payouts are in Danish kroner",
    },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted">
          Admin team, email notifications, platform details, and system
          constants.
        </p>
      </div>

      <div className="space-y-10">
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

        <TeamInvites invites={teammateInvites} canManage={canManageTeam} />

        <NotificationsPanel
          role="admin"
          preferences={myPreferences}
          warningsByType={{ submissions: submissionsWarning }}
        />

        <DiscoverabilityToggle
          orgId={orgId}
          discoverable={org?.discoverable ?? false}
          orgName={org?.name ?? ""}
          orgDescription={org?.description ?? ""}
        />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Platform details</h2>
            <p className="text-muted text-sm">
              Configured through environment variables. These appear on
              invoices, in the footer, and in emails.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {platformRows.map((row, i) => (
                  <tr
                    key={row.env}
                    className={i > 0 ? "border-t border-border" : ""}
                  >
                    <td className="px-4 py-3 w-48">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="font-mono text-xs text-muted mt-0.5">
                        {row.env}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.value ? (
                        <p className="text-sm break-all">{row.value}</p>
                      ) : (
                        <p className="text-sm text-warning">Not set</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right w-32">
                      {row.isSet ? (
                        <StatusPill tone="neutral" dot={false}>
                          From env
                        </StatusPill>
                      ) : (
                        <StatusPill tone="warning" dot={false}>
                          Default
                        </StatusPill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">System constants</h2>
            <p className="text-muted text-sm">
              Defined in code. Changing any of these requires a code change
              and deploy.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {constantRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i > 0 ? "border-t border-border" : ""}
                  >
                    <td className="px-4 py-3 w-48">
                      <p className="text-sm font-medium">{row.label}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm">{row.value}</p>
                      <p className="text-xs text-muted mt-0.5">{row.note}</p>
                    </td>
                    <td className="px-4 py-3 text-right w-32">
                      <StatusPill tone="neutral" dot={false}>
                        In code
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

interface PlatformRow {
  label: string;
  value: string;
  env: string;
  isSet: boolean;
}

interface ConstantRow {
  label: string;
  value: string;
  note: string;
}
