"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { switchOrg } from "@/app/admin/settings/org-actions";

// Paths whose [id] segment is org-scoped and would 404 after a switch
// to an org that doesn't have access to that resource. Used to bounce
// the user up to the parent listing on switch instead of refreshing
// in place.
const ORG_SCOPED_DETAIL_PATTERNS: { pattern: RegExp; parent: string }[] = [
  { pattern: /^\/briefs\/[^/]+/, parent: "/briefs" },
];

interface Org {
  id: string;
  name: string;
  role: string;
}

export function OrgSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function loadOrgs() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("id", user.id)
        .single();

      setActiveOrgId(profile?.active_org_id ?? null);

      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id, role, org:organizations(id, name)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (memberships) {
        setOrgs(
          memberships
            .filter((m: any) => m.org)
            .map((m: any) => ({
              id: m.org.id,
              name: m.org.name,
              role: m.role,
            }))
        );
      }
    }
    loadOrgs();
  }, []);

  // Don't render if user has 0 or 1 org
  if (orgs.length <= 1) return null;

  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrgId) return;
    setSwitching(true);
    const result = await switchOrg(orgId);
    if (result.ok) {
      setActiveOrgId(orgId);
      // If we're on an org-scoped detail page (e.g. /briefs/[id]),
      // the resource almost certainly belongs to the previous org and
      // would 404 in the new one. Bounce to the parent listing.
      const detailMatch = ORG_SCOPED_DETAIL_PATTERNS.find((p) =>
        p.pattern.test(pathname)
      );
      if (detailMatch) {
        router.push(detailMatch.parent);
      } else {
        router.refresh();
      }
    }
    setSwitching(false);
  }

  return (
    <select
      value={activeOrgId || ""}
      onChange={(e) => handleSwitch(e.target.value)}
      disabled={switching}
      className="no-global-focus-ring px-2.5 py-1 bg-transparent border border-border rounded-md text-xs text-muted hover:text-foreground hover:border-border-strong focus-visible:outline-none focus:border-accent transition-colors cursor-pointer disabled:opacity-50"
      title="Switch organization"
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name} ({org.role})
        </option>
      ))}
    </select>
  );
}
