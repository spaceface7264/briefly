import { redirect } from "next/navigation";
import { requireOrgAdmin } from "@/lib/org";
import { InviteActions } from "./invite-actions";

export default async function AdminInvitesPage() {
  // Creator-invite issuance is admin-only. requireOrgAdmin() also
  // accepts platform admins scoped into this org via support mode.
  const gate = await requireOrgAdmin();
  if (!gate.ok) redirect("/admin");
  const { supabase, orgId } = gate;

  const { data: invites } = await (supabase as any)
    .from("invite_codes")
    .select("*, created_by_profile:profiles!invite_codes_created_by_fkey(name, email), used_by_profile:profiles!invite_codes_used_by_fkey(name, email)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const unusedCount = (invites || []).filter((i: any) => !i.used_by).length;
  const usedCount = (invites || []).filter((i: any) => i.used_by).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Invite Codes</h1>
          <p className="text-muted mt-1">
            {unusedCount} available, {usedCount} used
          </p>
        </div>
        <InviteActions />
      </div>

      {invites && invites.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Code</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Created By</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Used By</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Created</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite: any) => {
                const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                const isUsed = !!invite.used_by;

                return (
                  <tr key={invite.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                        {invite.code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {isUsed ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-muted/20 text-muted">
                          Used
                        </span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-error/20 text-error">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-success/20 text-success">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {invite.created_by_profile?.name || invite.created_by_profile?.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {invite.used_by_profile ? (
                        <span>
                          {invite.used_by_profile.name || invite.used_by_profile.email}
                          <span className="text-muted ml-2">
                            {invite.used_at && new Date(invite.used_at).toLocaleDateString("en-GB")}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {new Date(invite.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {invite.expires_at
                        ? new Date(invite.expires_at).toLocaleDateString("en-GB")
                        : "Never"
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted mb-4">No invite codes yet</p>
          <p className="text-sm text-muted">Click "Generate Codes" to create some</p>
        </div>
      )}
    </div>
  );
}
