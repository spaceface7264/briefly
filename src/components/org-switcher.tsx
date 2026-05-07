"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { switchOrg } from "@/app/admin/settings/org-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Shape of a single row from the membership join. Hand-written rather
// than pulled from generated database types because Supabase returns
// the joined `org` as a record-or-array depending on the relation
// inference, and the runtime value here is always a single record.
interface MembershipRow {
  org_id: string;
  role: string;
  org: { id: string; name: string } | null;
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
        const rows = memberships as unknown as MembershipRow[];
        setOrgs(
          rows
            .filter((m): m is MembershipRow & { org: { id: string; name: string } } =>
              m.org !== null
            )
            .map((m) => ({
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
  const triggerLabel = activeOrg?.name ?? "Switch organization";

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrgId || switching) return;
    setSwitching(true);
    try {
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
    } finally {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={switching}
        aria-label="Switch organization"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 data-popup-open:border-border-strong data-popup-open:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="max-w-[160px] truncate">{triggerLabel}</span>
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        // Override the wrapper's default `w-(--anchor-width)` so the
        // panel sizes to its widest org name (plus checkmark padding)
        // instead of inheriting the trigger's truncated 160px width.
        // The min keeps the panel from collapsing to barely-wider-than-
        // the-checkmark when every org has a short name.
        className="!w-auto min-w-56"
      >
        <DropdownMenuRadioGroup
          value={activeOrgId ?? ""}
          onValueChange={(value) => {
            if (typeof value === "string") {
              void handleSwitch(value);
            }
          }}
        >
          {orgs.map((org) => (
            <DropdownMenuRadioItem
              key={org.id}
              value={org.id}
              className="text-sm"
            >
              <span className="truncate">{org.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
