"use client";

import Link from "next/link";
import { PlatformLogo } from "@/components/platform-logo";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface AdminNavProps {
  /** The signed-in user's id; used to subscribe to claim-notification realtime updates. */
  userId: string;
  /** Whether the viewer is an admin of the active org. Drives the lock state on Invites + Billing. */
  isOrgAdmin: boolean;
  /** Whether the viewer is a platform admin. Drives the "Platform admin" link in the footer. */
  isPlatformAdmin: boolean;
  /** Active org branding shown as the top-left identity anchor of the sidebar. */
  org: {
    name: string;
    logoUrl: string | null;
    accentColor: string | null;
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** True when only org admins (not members) may click into the page. */
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/admin/briefs",
    label: "Briefs",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/claims",
    label: "Claims",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/creators",
    label: "Creators",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    href: "/admin/invites",
    label: "Invites",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/billing",
    label: "Billing",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/admin/organization",
    label: "Organization",
    // Not adminOnly — members can view the org page read-only. The
    // OrgDetailsForm/View split inside the page handles the
    // editable-vs-readonly choice based on role.
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function AdminNav({
  userId,
  isOrgAdmin,
  isPlatformAdmin,
  org,
}: AdminNavProps) {
  const pathname = usePathname();
  // Only the claim-unread badge needs client state. The role/admin
  // flags arrive from the parent server layout, so the very first
  // render already has the correct lock state — no flash.
  const [claimUnread, setClaimUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    async function loadUnread() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("recipient_id", userId)
        .eq("event_type", "claim_submitted")
        .is("read_at", null);

      setClaimUnread(count ?? 0);
    }

    loadUnread();

    channel = supabase
      .channel(`admin-claims-unread:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const orgInitial = org.name.charAt(0).toUpperCase();
  const orgAccent = org.accentColor ?? "#C8FF00";

  return (
    <>
      {/* Mobile top bar — only visible below md. Hosts the hamburger,
          a compact org identity, and the claim-submitted unread badge
          so admins don't have to open the drawer to see it. */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-surface/90 backdrop-blur-xl border-b border-border">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="-ml-2 inline-flex items-center justify-center w-10 h-10 rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2 min-w-0">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={org.name}
              className="w-7 h-7 rounded object-cover shrink-0 border border-border bg-background"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-7 h-7 rounded flex items-center justify-center text-background font-bold text-sm shrink-0"
              style={{ backgroundColor: orgAccent }}
            >
              {orgInitial}
            </div>
          )}
          <span className="text-sm font-semibold truncate">{org.name}</span>
        </Link>
        {claimUnread > 0 && (
          <span
            aria-label={`${claimUnread} unread claim notifications`}
            className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-accent text-background px-1.5 text-[11px] font-semibold"
          >
            {claimUnread > 99 ? "99+" : claimUnread}
          </span>
        )}
      </div>

      {/* Backdrop on mobile when drawer is open. Tapping it closes
          the drawer; the aside itself sits above this layer. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="p-4 border-b border-border">
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-surface-hover transition-colors"
        >
          {org.logoUrl ? (
            // Org logos come from user uploads — Next/Image would need
            // every host configured in next.config.ts, so use a plain
            // <img> here as we do on /discover.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={org.name}
              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border bg-background"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-background font-bold text-lg shrink-0"
              style={{ backgroundColor: orgAccent }}
            >
              {orgInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" title={org.name}>
              {org.name}
            </div>
            {/* Reflects the viewer's role in this org, not the surface
                name — a member browsing /admin/* should see "Member",
                not "Admin". Admin gets the accent color to signal
                elevated access; member is muted. */}
            <div
              className={`text-[10px] font-medium uppercase tracking-wider ${
                isOrgAdmin ? "text-accent" : "text-muted"
              }`}
            >
              {isOrgAdmin ? "Admin" : "Member"}
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          const locked = item.adminOnly === true && !isOrgAdmin;

          if (locked) {
            return (
              <span
                key={item.href}
                role="button"
                aria-disabled="true"
                title="Admins only — ask an admin in your org"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted/50 cursor-not-allowed select-none"
              >
                {item.icon}
                {item.label}
                <svg
                  className="ml-auto w-3.5 h-3.5 text-muted/60"
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
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {item.icon}
              {item.label}
              {item.href === "/admin/claims" && claimUnread > 0 && (
                <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-background/15 px-1.5 text-[11px] font-semibold">
                  {claimUnread > 99 ? "99+" : claimUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        {isPlatformAdmin && (
          <Link
            href="/admin/super"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith("/admin/super")
                ? "bg-accent/10 text-accent"
                : "text-accent/80 hover:text-accent hover:bg-accent/5"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Platform admin
          </Link>
        )}
        <Link
          href="/discover"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Browse brands
        </Link>
      </div>

      {/* Platform attribution. The org owns the top of the sidebar; the
          platform is a quiet "powered by" mark at the bottom. */}
      <Link
        href="/"
        className="px-4 py-3 flex items-center gap-1.5 text-muted/50 hover:text-muted/80 transition-colors border-t border-border"
      >
        <span className="text-[10px] uppercase tracking-wider">
          Powered by
        </span>
        <PlatformLogo
          className="h-3 w-auto opacity-70"
          width={50}
          height={12}
          textClassName="text-[10px] font-bold tracking-tight"
        />
      </Link>
      </aside>
    </>
  );
}
