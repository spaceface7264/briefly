"use client";

import Link from "next/link";
import { PlatformLogo } from "@/components/platform-logo";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
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
  ActivityIcon,
  BellIcon,
  BookOpenIcon,
  Building2Icon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  GaugeIcon,
  LogOutIcon,
  ScaleIcon,
  Settings2Icon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ThemeMenuItems } from "@/components/theme-menu-items";

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
] as const;

interface PlatformNavProps {
  userEmail: string;
  userName: string | null;
  userAvatarUrl: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Exact-match the active state. Default is prefix-match. The
   *  Overview tab needs this so /admin/super/orgs doesn't activate
   *  it. */
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/admin/super",
    label: "Overview",
    exact: true,
    icon: <GaugeIcon />,
  },
  {
    href: "/admin/super/health",
    label: "Health",
    icon: <ActivityIcon />,
  },
  {
    href: "/admin/super/orgs",
    label: "Orgs",
    icon: <Building2Icon />,
  },
  {
    href: "/admin/super/users",
    label: "Users",
    icon: <UsersIcon />,
  },
  {
    href: "/admin/super/money",
    label: "Money tools",
    icon: <WalletIcon />,
  },
  {
    href: "/admin/super/notices",
    label: "Notices",
    icon: <BellIcon />,
  },
  {
    href: "/admin/super/platform",
    label: "Platform",
    icon: <Settings2Icon />,
  },
  {
    href: "/admin/super/audit",
    label: "Audit log",
    icon: <ClipboardListIcon />,
  },
];

export function PlatformNav({
  userEmail,
  userName,
  userAvatarUrl,
}: PlatformNavProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <PlatformIdentity />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavRow key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
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
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Top-left identity anchor. Mirrors the OrgIdentity treatment in the
 * org admin shell but anchors on the platform brand. The "Platform"
 * subtitle uses the accent color to mark the elevated context.
 */
function PlatformIdentity() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Link
      href="/admin/super"
      className="flex items-center gap-3 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors"
      aria-label="Platform overview"
    >
      <div
        aria-hidden="true"
        className="size-8 rounded-md flex items-center justify-center bg-accent/10 border border-accent/30 shrink-0"
      >
        <PlatformLogo
          className="h-4 w-auto"
          width={28}
          height={16}
          textClassName="text-[9px] font-bold tracking-tight"
        />
      </div>
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">Platform</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-accent">
            Admin
          </div>
        </div>
      )}
    </Link>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={isActive}
        // Active rows render as an inert <span> so re-clicking the
        // current page doesn't trigger a soft refetch. aria-current
        // surfaces the active state to assistive tech.
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
    </SidebarMenuItem>
  );
}

/**
 * Footer user menu, identical pattern to AdminNav so the muscle
 * memory carries between shells. The "Account" entry intentionally
 * routes back to /admin/settings even though that's the org-admin
 * surface, since platform users have no separate account page yet
 * (their personal profile is still managed there for now).
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <BookOpenIcon />
            Legal
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LEGAL_LINKS.map((link) => (
              <DropdownMenuItem
                key={link.href}
                render={<Link href={link.href} />}
              >
                <ScaleIcon />
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
