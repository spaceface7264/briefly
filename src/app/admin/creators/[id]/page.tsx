import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import {
  countryLabel,
  languageLabel,
  skillLabel,
} from "@/lib/creator-profile";
import type { Profile } from "@/types/database";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);

  const [{ data: creator }, { data: membership }, { data: claims }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase
        .from("memberships")
        .select("role")
        .eq("user_id", id)
        .eq("org_id", orgId)
        .eq("status", "active")
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("claims") as any)
        .select("*, brief:briefs(id, title, price_dkk, category, duration_class)")
        .eq("user_id", id)
        .eq("org_id", orgId)
        .order("claimed_at", { ascending: false }),
    ]);

  if (!creator) {
    notFound();
  }

  const profile = creator as Profile;
  // Per-org role for this user (creator/admin/member). Falls back to
  // "creator" for users we somehow have records for without an active
  // membership in this org — shouldn't happen but keeps the page safe.
  const orgRole = (membership?.role as string | undefined) ?? "creator";

  // Calculate stats
  const activeClaims = (claims || []).filter((c: any) => c.status === "active");
  const submittedClaims = (claims || []).filter((c: any) => c.status === "submitted");
  const approvedClaims = (claims || []).filter((c: any) => c.status === "approved");
  const paidClaims = (claims || []).filter((c: any) => c.status === "paid");
  const cancelledClaims = (claims || []).filter((c: any) => c.status === "cancelled");

  const totalEarned = paidClaims.reduce((sum: number, c: any) => sum + (c.brief?.price_dkk || 0), 0);
  const pendingPayout = approvedClaims.reduce((sum: number, c: any) => sum + (c.brief?.price_dkk || 0), 0);

  return (
    <div>
      <Link href="/admin/creators" className="text-muted hover:text-foreground text-sm mb-2 inline-block">
        &larr; Back to Creators
      </Link>

      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-5 min-w-0">
          <Avatar
            url={profile.avatar_url}
            name={profile.name}
            email={profile.email}
            size="lg"
            alt=""
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">
              {profile.name || "Unnamed Creator"}
            </h1>
            <p className="text-muted truncate">{profile.email}</p>
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                @{profile.instagram_handle}
              </a>
            )}
          </div>
        </div>
        <RoleBadge role={orgRole} />
      </div>

      <ProfileSummary profile={profile} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-muted text-sm mb-1">Active Claims</p>
          <p className="text-2xl font-bold font-mono">{activeClaims.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-muted text-sm mb-1">Pending Review</p>
          <p className="text-2xl font-bold font-mono text-warning">{submittedClaims.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-muted text-sm mb-1">Total Earned</p>
          <p className="text-2xl font-bold font-mono text-success">{formatPrice(totalEarned)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-muted text-sm mb-1">Pending Payout</p>
          <p className="text-2xl font-bold font-mono">{formatPrice(pendingPayout)}</p>
        </div>
      </div>

      {/* Claims History */}
      <h2 className="text-xl font-semibold mb-4">Claims History ({claims?.length || 0})</h2>
      {claims && claims.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Brief</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Category</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Price</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim: any) => (
                <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/admin/briefs/${claim.brief?.id}`} className="font-medium hover:text-accent">
                      {claim.brief?.title || "Unknown Brief"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full capitalize">
                      {claim.brief?.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {formatPrice(claim.brief?.price_dkk)}
                  </td>
                  <td className="px-4 py-3">
                    <ClaimStatusBadge status={claim.status} />
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-sm">
                    {new Date(claim.claimed_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted">No claims yet</p>
        </div>
      )}

      {/* Account Info */}
      <div className="mt-8 bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Account Info</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Joined</dt>
            <dd className="font-mono">{new Date(profile.created_at).toLocaleDateString("en-GB")}</dd>
          </div>
          <div>
            <dt className="text-muted">User ID</dt>
            <dd className="font-mono text-xs break-all">{profile.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ProfileSummary({ profile }: { profile: Profile }) {
  const country = countryLabel(profile.country);
  const languages = profile.languages ?? [];
  const skills = profile.skills ?? [];
  const bio = profile.bio?.trim() ?? "";

  // Hide the section entirely when the creator hasn't filled
  // anything in yet — an empty card with four "—" rows just adds
  // noise on accounts that pre-date Phase 2.
  if (!country && !languages.length && !skills.length && !bio) {
    return null;
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-8 space-y-4">
      {bio && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-1">
            Bio
          </h2>
          <p className="text-sm whitespace-pre-line">{bio}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryRow label="Country" value={country} />
        <SummaryChips
          label="Languages"
          values={languages}
          format={languageLabel}
        />
        <SummaryChips
          label="Skills"
          values={skills}
          format={skillLabel}
          tone="brand"
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted mb-1">
        {label}
      </dt>
      <dd className="text-sm">
        {value ?? <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

function SummaryChips({
  label,
  values,
  format,
  tone = "muted",
}: {
  label: string;
  values: string[];
  format: (value: string) => string;
  tone?: "muted" | "brand";
}) {
  const chipClass =
    tone === "brand"
      ? "px-2 py-0.5 text-xs font-medium rounded-full bg-brand-muted text-brand"
      : "px-2 py-0.5 text-xs font-medium rounded-full bg-accent-muted text-accent";

  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted mb-1">
        {label}
      </dt>
      <dd>
        {values.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {values.map((value) => (
              <span key={value} className={chipClass}>
                {format(value)}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted text-sm">—</span>
        )}
      </dd>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-accent text-background",
    member: "bg-accent-muted text-accent",
    creator: "bg-accent-muted text-accent",
  };

  return (
    <span
      className={`px-3 py-1.5 text-sm font-medium rounded-full capitalize ${styles[role] || styles.creator}`}
    >
      {role}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    cancelled: "bg-error/20 text-error",
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}
