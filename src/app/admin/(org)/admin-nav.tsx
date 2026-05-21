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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
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
  Building2Icon,
  ChevronsUpDownIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  PaletteIcon,
  ScaleIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ThemeMenuItems } from "@/components/theme-menu-items";

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/self-billing", label: "Self-billing agreement" },
] as const;

interface AdminNavProps {
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
  /** Platform admin scoped into someone else's org via support mode.
   *  Repaints the org-identity chip and removes the legacy "creator
   *  signs out here" affordances we don't want a support session
   *  exiting through. */
  isSupportMode: boolean;
  /** Active org branding shown as the top-left identity anchor of the sidebar.
   *  `id` also scopes the realtime queue counters (claims awaiting review,
   *  applications awaiting a decision). */
  org: {
    id: string;
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

interface NavSection {
  /** Section label shown above the items. Null for the top section
   *  (the dashboard sits there with no header so the rail starts
   *  uncluttered). */
  label: string | null;
  items: NavItem[];
}

// Grouping mirrors the admin's mental model: home, daily work, the
// creator network, then setup. The flat 10-row list this replaces
// gave every route equal weight, which made the rail feel busy and
// buried the routes admins actually use every day.
const navSections: NavSection[] = [
  {
    label: null,
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: <LayoutDashboardIcon />,
      },
    ],
  },
  {
    label: "Work",
    items: [
      {
        href: "/admin/briefs",
        label: "Briefs",
        icon: <FileTextIcon />,
      },
      {
        href: "/admin/claims",
        label: "Claims",
        icon: <ClipboardCheckIcon />,
      },
      {
        href: "/admin/applications",
        label: "Applications",
        icon: <UserPlusIcon />,
      },
    ],
  },
  {
    label: "Network",
    items: [
      {
        href: "/admin/creators",
        label: "Creators",
        icon: <UsersIcon />,
      },
      {
        href: "/admin/invites",
        label: "Invites",
        adminOnly: true,
        icon: <MailIcon />,
      },
    ],
  },
  {
    label: "Setup",
    items: [
      {
        href: "/admin/organization",
        // Not adminOnly, members can view the org page read-only. The
        // OrgDetailsForm/View split inside the page handles the
        // editable-vs-readonly choice based on role.
        label: "Organization",
        icon: <Building2Icon />,
      },
      {
        href: "/admin/brand",
        // Not adminOnly. Members read the brand kit (logos, palette,
        // typography, guidelines) so they share visual context with
        // the org. Edit gating happens server-side via requireOrgAdmin().
        label: "Brand",
        icon: <PaletteIcon />,
      },
      {
        href: "/admin/billing",
        label: "Billing",
        adminOnly: true,
        icon: <CreditCardIcon />,
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: <SettingsIcon />,
      },
    ],
  },
];

export function AdminNav({
  userEmail,
  userName,
  userAvatarUrl,
  isOrgAdmin,
  isPlatformAdmin,
  isSupportMode,
  org,
}: AdminNavProps) {
  // Badges count work the org has to act on: claims awaiting review and
  // applications awaiting a decision. Both drop to zero the moment the
  // admin treats the item, so the rail stays honest. Role/admin flags
  // arrive from the server layout, so the very first render already has
  // the correct lock state, no flash.
  const [claimsPending, setClaimsPending] = useState(0);
  const [applicationsPending, setApplicationsPending] = useState(0);
  const pathname = usePathname();
  const platformAdminActive = pathname.startsWith("/admin/super");
  const orgId = org.id;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let claimsChannel: RealtimeChannel | null = null;
    let appsChannel: RealtimeChannel | null = null;

    async function loadClaims() {
      const { count } = await supabase
        .from("claims")
        .select("id", { head: true, count: "exact" })
        .eq("org_id", orgId)
        .eq("status", "submitted");
      if (!cancelled) setClaimsPending(count ?? 0);
    }

    async function loadApplications() {
      const { count } = await supabase
        .from("org_applications")
        .select("id", { head: true, count: "exact" })
        .eq("org_id", orgId)
        .eq("status", "pending");
      if (!cancelled) setApplicationsPending(count ?? 0);
    }

    loadClaims();
    loadApplications();

    claimsChannel = supabase
      .channel(`admin-claims-queue:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claims",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          loadClaims();
        }
      )
      .subscribe();

    appsChannel = supabase
      .channel(`admin-applications-queue:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "org_applications",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          loadApplications();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (claimsChannel) void supabase.removeChannel(claimsChannel);
      if (appsChannel) void supabase.removeChannel(appsChannel);
    };
  }, [orgId]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        {/* Brand on the left, sidebar collapse toggle on the right.
            In icon-collapsed mode the brand hides (no room) and the
            trigger centres so users can re-expand from inside the
            sidebar. The trigger lives here so we don't need a
            standalone header bar floating above the page. */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <OrgIdentity
              org={org}
              isOrgAdmin={isOrgAdmin}
              isSupportMode={isSupportMode}
            />
          </div>
          <SidebarTrigger className="shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section, idx) => (
          <SidebarGroup key={section.label ?? `top-${idx}`}>
            {section.label && (
              <SidebarGroupLabel className="uppercase tracking-wide text-muted">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    isOrgAdmin={isOrgAdmin}
                    claimsPending={claimsPending}
                    applicationsPending={applicationsPending}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {isPlatformAdmin && !isSupportMode && (
          // In support mode the banner is the platform-admin entry
          // point (and the only correct exit). Repeating the link
          // here would suggest the user can swap surfaces while
          // staying scoped in, which they can't.
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Platform admin"
                isActive={platformAdminActive}
                className="text-brand-ink/90 data-active:bg-brand-muted data-active:text-brand-ink"
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
  isSupportMode,
}: {
  org: AdminNavProps["org"];
  isOrgAdmin: boolean;
  isSupportMode: boolean;
}) {
  const orgInitial = org.name.charAt(0).toUpperCase();
  const orgAccent = org.accentColor ?? "#09D7D7";
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  // Role chip varies by viewer:
  //   * support mode  → "Support" with a warning tone
  //   * org admin     → "Admin" in accent
  //   * org member    → "Member" muted
  const chip = isSupportMode
    ? { label: "Support", className: "text-warning-ink" }
    : isOrgAdmin
      ? { label: "Admin", className: "text-brand-ink" }
      : { label: "Member", className: "text-muted" };

  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors"
      aria-label={`${org.name} dashboard`}
    >
      {org.logoUrl ? (
        // Org logos come from user uploads, Next/Image would need
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
          className="size-8 rounded-md flex items-center justify-center text-on-brand font-bold text-sm shrink-0"
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
          <div
            className={`text-[10px] font-medium uppercase tracking-wider ${chip.className}`}
          >
            {chip.label}
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
        <ThemeMenuItems />
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
  claimsPending,
  applicationsPending,
}: {
  item: NavItem;
  isOrgAdmin: boolean;
  claimsPending: number;
  applicationsPending: number;
}) {
  const isActive = useIsActiveRoute(item.href);
  const locked = item.adminOnly === true && !isOrgAdmin;
  const badgeCount =
    item.href === "/admin/claims"
      ? claimsPending
      : item.href === "/admin/applications"
        ? applicationsPending
        : 0;

  if (locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Admins only, ask an admin in your org"
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
        // When active, render an inert <span> instead of a Link so a
        // second click on the current row doesn't trigger a redundant
        // soft refetch. aria-current makes the active state legible
        // to screen readers; cursor-default telegraphs that the row
        // isn't actionable.
        render={
          isActive ? (
            <span aria-current="page" className="cursor-default" />
          ) : (
            <Link href={item.href} />
          )
        }
      >
        {item.icon}
        <span>{item.label}</span>
      </SidebarMenuButton>
      {badgeCount > 0 && (
        <SidebarMenuBadge className="bg-brand-muted text-brand-ink">
          {badgeCount > 99 ? "99+" : badgeCount}
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
