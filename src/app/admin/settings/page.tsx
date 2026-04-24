import { createClient } from "@/lib/supabase/server";
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

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: admins }, { data: creators }, { data: me }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, email, created_at, notify_submissions")
        .eq("role", "admin")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, name, email, created_at")
        .eq("role", "creator")
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select(
          "notify_submissions, notify_new_briefs, notify_claim_updates, notify_claim_queue, notify_payments"
        )
        .eq("id", user.id)
        .single(),
    ]);

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
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "creators@boulders.dk";
  const contactEmailFromEnv = Boolean(process.env.NEXT_PUBLIC_CONTACT_EMAIL);

  const platformRows: PlatformRow[] = [
    {
      label: "Company name",
      value: platform.name,
      env: "PLATFORM_NAME",
      isSet: Boolean(process.env.PLATFORM_NAME),
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
    {
      label: "Contact email",
      value: contactEmail,
      env: "NEXT_PUBLIC_CONTACT_EMAIL",
      isSet: contactEmailFromEnv,
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
        <AdminTeam
          admins={admins ?? []}
          creators={creators ?? []}
          currentUserId={user.id}
        />

        <NotificationsPanel
          role="admin"
          preferences={myPreferences}
          warningsByType={{ submissions: submissionsWarning }}
        />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Platform details</h2>
            <p className="text-muted text-sm">
              Configured through environment variables. These appear on
              invoices, in the footer, and in emails.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full min-w-[560px]">
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

          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full min-w-[560px]">
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
