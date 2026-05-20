"use client";

import Link from "next/link";
import { PlatformLogo } from "@/components/platform-logo";
import { OrgSwitcher } from "@/components/org-switcher";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/avatar";
import { NotificationCenter } from "@/components/notification-center";
import { ModeToggle } from "@/components/mode-toggle";
import { ThemeMenuItems } from "@/components/theme-menu-items";
import { buttonVariants } from "@/components/ui/button";
import type { NotificationRow } from "@/lib/notification-center";

const creatorNavItems = [
  { href: "/briefs", label: "Briefs" },
  { href: "/my-briefs", label: "My Briefs" },
  { href: "/discover", label: "Discover" },
  // How it works + Guide hidden pending an iterated redesign — the
  // routes still exist (footer + deep links) so this is a nav-only
  // hide, not a removal.
];

const publicNavItems = [
  { href: "/discover", label: "Discover" },
];

const creatorProfileItems = [
  { href: "/profile/earnings", label: "Earnings" },
  { href: "/profile/invoices", label: "Invoices" },
  { href: "/profile/applications", label: "Applications" },
  { href: "/profile/settings", label: "Settings" },
];

type AccountType = "creator" | "org";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileLabel, setProfileLabel] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function checkAccount() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setAccountChecked(true);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const typed = profile as
        | {
            account_type?: string;
            name?: string | null;
            email?: string | null;
            avatar_url?: string | null;
          }
        | null;
      setAccountType(typed?.account_type === "org" ? "org" : "creator");
      // Prefer the profile name; fall back to the email so the
      // dropdown header is never blank for a freshly-signed-up
      // creator who hasn't filled out their profile yet.
      setProfileLabel(typed?.name?.trim() || typed?.email?.trim() || null);
      setProfileName(typed?.name ?? null);
      setProfileEmail(typed?.email ?? user.email ?? null);
      setProfileAvatarUrl(typed?.avatar_url ?? null);
      setAccountChecked(true);
    }
    checkAccount();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    async function loadNotifications() {
      const { data } = await supabase
        .from("notifications")
        .select("*, org:organizations(name, logo_url)")
        .eq("recipient_id", currentUserId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(20);

      const rows = (data ?? []) as unknown as NotificationRow[];
      setNotifications(rows);
      setUnreadCount(rows.filter((row) => !row.read_at).length);
    }

    function subscribe() {
      channel = supabase
        .channel(`notifications:${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    }

    loadNotifications();
    subscribe();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const isProfileActive = pathname.startsWith("/profile");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isLoggedOut = accountChecked && !userId;
  const isOrgUser = accountType === "org";
  const homeHref = isLoggedOut ? "/" : isOrgUser ? "/admin" : "/briefs";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={homeHref}
              className="flex items-center"
            >
              <PlatformLogo className="h-6 w-auto" width={120} height={32} priority />
            </Link>
            {!isLoggedOut && !isOrgUser && <OrgSwitcher />}
          </div>

          {isLoggedOut ? (
            <nav className="flex items-center gap-1 overflow-visible">
              {publicNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const baseCls =
                  "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap";
                return isActive ? (
                  <span
                    key={item.href}
                    aria-current="page"
                    className={`${baseCls} text-brand-ink cursor-default`}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${baseCls} text-muted hover:text-foreground`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <ModeToggle />
              <Link
                href="/login"
                className={buttonVariants({ variant: "default" })}
              >
                Login
              </Link>
            </nav>
          ) : isOrgUser ? (
            // Org users on shared surfaces (e.g. /discover) get a
            // minimal "exit chrome" — they're outside their dashboard,
            // so we just give them a clear way back and a sign-out.
            // Profile, notifications, and team management all live
            // inside /admin/settings.
            <nav className="flex items-center gap-3 overflow-visible">
              <Link
                href="/admin"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-brand-ink/40 text-accent-ink hover:bg-accent hover:text-background transition-all whitespace-nowrap ${
                  accountChecked ? "opacity-100" : "opacity-0"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to dashboard
              </Link>
              <ModeToggle />
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </nav>
          ) : (
          <nav className="flex items-center gap-1 overflow-visible">
            {creatorNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              const baseCls =
                "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap";
              return isActive ? (
                <span
                  key={item.href}
                  aria-current="page"
                  className={`${baseCls} text-brand-ink cursor-default`}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${baseCls} text-muted hover:text-foreground`}
                >
                  {item.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className={`relative px-1 py-1 rounded-full transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isProfileActive
                    ? "ring-2 ring-brand"
                    : "hover:bg-surface-hover"
                }`}
              >
                <Avatar
                  url={profileAvatarUrl}
                  name={profileName}
                  email={profileEmail}
                  size="sm"
                  alt=""
                  className="border-0"
                />
                <svg
                  className="w-3.5 h-3.5 opacity-60 mr-1 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-surface border-border">
                {profileLabel && (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Signed in as
                      </p>
                      <p className="text-sm font-medium truncate">
                        {profileLabel}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                {creatorProfileItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/profile" &&
                      pathname.startsWith(item.href));
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={
                        isActive
                          ? "text-brand-ink cursor-default"
                          : ""
                      }
                      onClick={
                        isActive ? undefined : () => router.push(item.href)
                      }
                    >
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                <ThemeMenuItems />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-muted focus:text-error"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onNotificationsChange={setNotifications}
              onUnreadCountChange={setUnreadCount}
            />
          </nav>
          )}
        </div>
      </div>
    </header>
  );
}
