import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Profile } from "@/types/database";

export default async function AdminCreatorsPage() {
  const supabase = await createClient();

  const { data: creators } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "creator")
    .order("created_at", { ascending: false });

  // Get claim counts for each creator
  const creatorsWithCounts = await Promise.all(
    ((creators || []) as Profile[]).map(async (creator) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [activeResult, completedResult] = await Promise.all([
        (supabase.from("claims") as any)
          .select("*", { count: "exact", head: true })
          .eq("user_id", creator.id)
          .eq("status", "active"),
        (supabase.from("claims") as any)
          .select("*", { count: "exact", head: true })
          .eq("user_id", creator.id)
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Creators</h1>
        <p className="text-muted">{creatorsWithCounts.length} creator{creatorsWithCounts.length !== 1 ? "s" : ""}</p>
      </div>

      {creatorsWithCounts.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Creator</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Instagram</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Active Claims</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Completed</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Joined</th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {creatorsWithCounts.map((creator) => (
                <tr key={creator.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <p className="font-medium">{creator.name || "No name"}</p>
                    <p className="text-muted text-sm">{creator.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {creator.instagram_handle ? (
                      <a
                        href={`https://instagram.com/${creator.instagram_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        @{creator.instagram_handle}
                      </a>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
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
                      <span className="text-success">{creator.completedClaims}</span>
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
              ))}
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
