"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const navItems = [
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
    href: "/admin/invites",
    label: "Invites",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

interface AdminNavProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function AdminNav({ collapsed = false, onToggleCollapsed }: AdminNavProps) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [claimUnread, setClaimUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
    }

    bootstrap();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    async function loadUnread() {
      const { count } = await supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("recipient_id", currentUserId)
        .eq("event_type", "claim_submitted")
        .is("read_at", null);

      setClaimUnread(count ?? 0);
    }

    loadUnread();

    channel = supabase
      .channel(`admin-claims-unread:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUserId}`,
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

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prev;
    };
  }, [mobileOpen]);

  function renderNavContent(isCollapsed: boolean, showToggle: boolean) {
    return (
      <>
        <div
          className={`${
            isCollapsed ? "px-2 py-3" : "p-6"
          } border-b border-border flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          } gap-2`}
        >
          {!isCollapsed && (
            <Link href="/admin" className="flex items-center gap-2 min-w-0">
              <Image
                src="https://storage.googleapis.com/boulderscss/logo-flat-white.png"
                alt="Boulders"
                width={100}
                height={28}
                className="h-7 w-auto"
              />
              <span className="text-xs font-medium text-accent uppercase tracking-wider">
                Admin
              </span>
            </Link>
          )}
          {showToggle && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
                />
              </svg>
            </button>
          )}
        </div>

        <nav className={`flex-1 ${isCollapsed ? "p-2" : "p-4"} space-y-1 overflow-y-auto`}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center ${
                  isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-4 py-3"
                } rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-background"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <span className="relative inline-flex">
                  {item.icon}
                  {item.href === "/admin/claims" &&
                    claimUnread > 0 &&
                    isCollapsed && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-error ring-2 ring-surface"
                      />
                    )}
                </span>
                {!isCollapsed && (
                  <>
                    <span>{item.label}</span>
                    {item.href === "/admin/claims" && claimUnread > 0 && (
                      <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-background/15 px-1.5 text-[11px] font-semibold">
                        {claimUnread > 99 ? "99+" : claimUnread}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`${isCollapsed ? "p-2" : "p-4"} border-t border-border`}>
          <Link
            href="/briefs"
            title={isCollapsed ? "Back to Creator View" : undefined}
            className={`flex items-center ${
              isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-4 py-3"
            } rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            {!isCollapsed && <span>Back to Creator View</span>}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-background/90 backdrop-blur-xl border-b border-border">
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="https://storage.googleapis.com/boulderscss/logo-flat-white.png"
            alt="Boulders"
            width={100}
            height={28}
            className="h-6 w-auto"
          />
          <span className="text-[10px] font-medium text-accent uppercase tracking-wider">Admin</span>
        </Link>
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer — always full-content (collapse only applies to desktop) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside className="relative flex h-full w-64 max-w-[78vw] flex-col bg-surface border-r border-border shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {renderNavContent(false, false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar (lg+) — collapsible */}
      <aside
        className={`hidden lg:flex fixed left-0 top-0 h-screen ${
          collapsed ? "w-16" : "w-64"
        } bg-surface border-r border-border flex-col transition-[width] duration-200`}
      >
        {renderNavContent(collapsed, true)}
      </aside>
    </>
  );
}
