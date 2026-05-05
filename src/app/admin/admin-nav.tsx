"use client";

import Link from "next/link";
import { PlatformLogo } from "@/components/platform-logo";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronsUpDownIcon,
  LockIcon,
  LogOutIcon,
  ScaleIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/self-billing", label: "Self-billing agreement" },
] as const;

interface AdminNavProps {
  /** The signed-in user's id; used to subscribe to claim-notification realtime updates. */
  userId: string;
  /** Email shown under the user's avatar in the sidebar footer menu. */
  userEmail: string;
  /** Display name shown above the email. Falls back to email when null. */
  userName: string | null;
  /** Public URL into the `avatars` bucket. When null the UserMenu falls back to the initial-letter tile. */
  userAvatarUrl: string | null;
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
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/admin/briefs",
    label: "Briefs",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/claims",
    label: "Claims",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/creators",
    label: "Creators",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    href: "/admin/invites",
    label: "Invites",
    adminOnly: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/billing",
    label: "Billing",
    adminOnly: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/admin/brand",
    label: "Brand",
    // Not adminOnly. Members read the brand kit (logos, palette,
    // typography, guidelines) so they share visual context with the
    // org. Edit gating happens server-side via requireOrgAdmin().
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function AdminNav({
  userId,
  userEmail,
  userName,
  userAvatarUrl,
  isOrgAdmin,
  isPlatformAdmin,
  org,
}: AdminNavProps) {
  // Only the claim-unread badge needs client state. Role/admin flags
  // arrive from the server layout, so the very first render already
  // has the correct lock state — no flash.
  const [claimUnread, setClaimUnread] = useState(0);
  const pathname = usePathname();
  const platformAdminActive = pathname.startsWith("/admin/super");

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <OrgIdentity org={org} isOrgAdmin={isOrgAdmin} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  isOrgAdmin={isOrgAdmin}
                  claimUnread={claimUnread}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {isPlatformAdmin && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Platform admin"
                isActive={platformAdminActive}
                className="text-accent/90 data-active:bg-accent/10 data-active:text-accent"
                render={<Link href="/admin/super" />}
              >
                <SparklesIcon />
                <span>Platform admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarSeparator />

        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu
              email={userEmail}
              name={userName}
              avatarUrl={userAvatarUrl}
            />
          </SidebarMenuItem>
        </SidebarMenu>

        <PoweredBy />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Org identity block in the sidebar header. Logo (or accent-colored
 * initial) + name + role chip. Collapses to just the logo when the
 * sidebar is in icon mode.
 */
function OrgIdentity({
  org,
  isOrgAdmin,
}: {
  org: AdminNavProps["org"];
  isOrgAdmin: boolean;
}) {
  const orgInitial = org.name.charAt(0).toUpperCase();
  const orgAccent = org.accentColor ?? "#C8FF00";
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors"
      aria-label={`${org.name} dashboard`}
    >
      {org.logoUrl ? (
        // Org logos come from user uploads — Next/Image would need
        // every host configured in next.config.ts, so use a plain
        // <img> here as we do on /discover.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logoUrl}
          alt={org.name}
          className="size-8 rounded-md object-cover shrink-0 border border-sidebar-border bg-background"
        />
      ) : (
        <div
          aria-hidden="true"
          className="size-8 rounded-md flex items-center justify-center text-background font-bold text-sm shrink-0"
          style={{ backgroundColor: orgAccent }}
        >
          {orgInitial}
        </div>
      )}
      {!isCollapsed && (
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
      )}
    </Link>
  );
}

/**
 * User identity block at the bottom of the sidebar. Avatar (initials
 * fallback until profile.avatar_url ships) + name + email serves as
 * the trigger for a dropdown that hosts account/sign-out actions.
 *
 * The dropdown opens to the right of the trigger on desktop; Base
 * UI's positioner flips it automatically on mobile if there's no
 * room. The collapsed (icon-only) sidebar still shows the avatar
 * tile, so signing out is one click away even when the rail is
 * shrunk.
 */
function UserMenu({
  email,
  name,
  avatarUrl,
}: {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const display = name?.trim() || email;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={display}
            className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          >
            <Avatar
              url={avatarUrl}
              name={name}
              email={email}
              size="md"
              alt=""
              className="size-8 rounded-md border-0 bg-sidebar-accent text-sidebar-accent-foreground"
            />
            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
              {name?.trim() ? (
                <>
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted">{email}</span>
                </>
              ) : (
                <span className="truncate font-medium">{email}</span>
              )}
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="min-w-56"
      >
        {/* Base UI requires GroupLabel inside a Group; the wrapper
            also gives us a logical grouping for the identity row vs.
            the actions below. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="grid gap-0.5 text-left text-sm leading-tight">
              {name?.trim() ? (
                <>
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted">{email}</span>
                </>
              ) : (
                <span className="truncate font-medium">{email}</span>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/admin/settings" />}>
          <UserIcon />
          Account
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ScaleIcon />
            Legal
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LEGAL_LINKS.map((link) => (
              <DropdownMenuItem
                key={link.href}
                render={<Link href={link.href} />}
              >
                {link.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One row in the main nav. Renders a locked button-with-tooltip when
 * the route is admin-only and the viewer isn't an admin, otherwise a
 * Link. Also paints the claim-unread badge on the Claims row.
 */
function NavRow({
  item,
  isOrgAdmin,
  claimUnread,
}: {
  item: NavItem;
  isOrgAdmin: boolean;
  claimUnread: number;
}) {
  const isActive = useIsActiveRoute(item.href);
  const locked = item.adminOnly === true && !isOrgAdmin;

  if (locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Admins only — ask an admin in your org"
          aria-disabled="true"
          className="cursor-not-allowed opacity-50"
        >
          {item.icon}
          <span>{item.label}</span>
          <LockIcon className="ml-auto size-3.5 opacity-70" aria-hidden="true" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={isActive}
        render={<Link href={item.href} />}
      >
        {item.icon}
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.href === "/admin/claims" && claimUnread > 0 && (
        <SidebarMenuBadge className="bg-accent/15 text-accent">
          {claimUnread > 99 ? "99+" : claimUnread}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

/** Active when the current pathname matches the item's href exactly,
 *  or starts with it (so /admin/briefs/[id] still highlights Briefs).
 *  Special-cased for the dashboard so /admin/briefs doesn't activate
 *  /admin. */
function useIsActiveRoute(href: string) {
  const pathname = usePathname();
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

/**
 * Quiet "Powered by <platform>" mark. Hidden in icon-collapsed mode
 * since it's pure branding with no affordance.
 */
function PoweredBy() {
  return (
    <Link
      href="/"
      className="flex items-center gap-1.5 px-3 py-2 text-muted/50 hover:text-muted/80 transition-colors group-data-[collapsible=icon]:hidden"
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
  );
}
