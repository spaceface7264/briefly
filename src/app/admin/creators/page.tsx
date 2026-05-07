import { createClient } from "@/lib/supabase/server";
import { getOrgRole, requireActiveOrg } from "@/lib/org";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  countryFlag,
  countryLabel,
  skillLabel,
} from "@/lib/creator-profile";
import {
  instagramDisplayHandle,
  instagramProfileUrl,
} from "@/lib/instagram";
import type { Profile } from "@/types/database";

export default async function AdminCreatorsPage() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);
  const role = await getOrgRole(supabase);
  const canManageRoster = role === "admin";

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, profile:profiles(*)")
    .eq("org_id", orgId)
    .eq("role", "creator")
    .eq("status", "active");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creators = (memberships || []).map((m: any) => m.profile).filter(Boolean) as Profile[];

  const creatorsWithCounts = await Promise.all(
    creators.map(async (creator) => {
      const [activeResult, completedResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("claims") as any)
          .select("*", { count: "exact", head: true })
          .eq("user_id", creator.id)
          .eq("org_id", orgId)
          .eq("status", "active"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("claims") as any)
          .select("*", { count: "exact", head: true })
          .eq("user_id", creator.id)
          .eq("org_id", orgId)
          .in("status", ["approved", "paid"]),
      ]);

      return {
        ...creator,
        activeClaims: activeResult.count || 0,
        completedClaims: completedResult.count || 0,
      };
    })
  );

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">Creators</h1>
          <p className="text-muted">
            {creatorsWithCounts.length} creator
            {creatorsWithCounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!canManageRoster && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-raised border border-border text-xs text-muted">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Roster changes are admin only
          </span>
        )}
      </div>

      {creatorsWithCounts.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Creator
                </th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Skills
                </th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Instagram
                </th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Active Claims
                </th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Completed
                </th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  Joined
                </th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {creatorsWithCounts.map((creator) => {
                const flag = countryFlag(creator.country);
                const country = countryLabel(creator.country);
                // First three skills only — keeps the row scannable.
                // The detail page renders the full set.
                const previewSkills = (creator.skills ?? []).slice(0, 3);
                const remaining =
                  (creator.skills?.length ?? 0) - previewSkills.length;
                return (
                  <tr
                    key={creator.id}
                    className="border-b border-border last:border-0 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          url={creator.avatar_url}
                          name={creator.name}
                          email={creator.email}
                          size="sm"
                          alt=""
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {creator.name || "No name"}
                            </p>
                            {flag && (
                              <span
                                className="text-base leading-none"
                                title={country ?? undefined}
                                aria-label={country ?? undefined}
                              >
                                {flag}
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-sm truncate">
                            {creator.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {previewSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {previewSkills.map((slug) => (
                            <span
                              key={slug}
                              className="px-2 py-0.5 text-xs font-medium rounded-full bg-brand-muted text-brand"
                            >
                              {skillLabel(slug)}
                            </span>
                          ))}
                          {remaining > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full text-muted">
                              +{remaining}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const display = instagramDisplayHandle(
                          creator.instagram_handle
                        );
                        const url = instagramProfileUrl(
                          creator.instagram_handle
                        );
                        if (!display) {
                          return <span className="text-muted">-</span>;
                        }
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            @{display}
                          </a>
                        ) : (
                          <span className="text-accent">@{display}</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {creator.activeClaims > 0 ? (
                        <Link
                          href={`/admin/claims?status=active`}
                          className="text-accent hover:underline"
                        >
                          {creator.activeClaims}
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {creator.completedClaims > 0 ? (
                        <span className="text-success">
                          {creator.completedClaims}
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {new Date(creator.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/creators/${creator.id}`}
                        className="text-accent hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted">No creators yet</p>
        </div>
      )}
    </div>
  );
}
