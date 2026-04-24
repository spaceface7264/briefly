import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import type { Profile } from "@/types/database";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!creator) {
    notFound();
  }

  // Get all claims for this creator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claims } = await (supabase.from("claims") as any)
    .select("*, brief:briefs(id, title, price_dkk, category, duration_class)")
    .eq("user_id", id)
    .order("claimed_at", { ascending: false });

  const profile = creator as Profile;

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

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{profile.name || "Unnamed Creator"}</h1>
          <p className="text-muted break-all">{profile.email}</p>
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
        <div className="shrink-0">
          <RoleBadge role={profile.role} />
        </div>
      </div>

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
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[760px]">
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-accent text-background",
    creator: "bg-accent-muted text-accent",
  };

  return (
    <span className={`px-3 py-1.5 text-sm font-medium rounded-full capitalize ${styles[role] || styles.creator}`}>
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
