"use client";

import Image from "next/image";
import Link from "next/link";
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
import { NotificationCenter } from "@/components/notification-center";
import type { NotificationRow } from "@/lib/notification-center";

const navItems = [
  { href: "/briefs", label: "Briefs" },
  { href: "/my-briefs", label: "My Briefs" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/guide", label: "Guide" },
];

const profileItems = [
  { href: "/profile", label: "Profile" },
  { href: "/profile/payouts", label: "Payouts" },
  { href: "/profile/invoices", label: "Invoices" },
  { href: "/profile/notifications", label: "Notifications" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setAdminChecked(true);
        return;
      }
      setUserId(user.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
      setAdminChecked(true);
    }
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    async function loadNotifications() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", currentUserId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(20);

      const rows = (data ?? []) as NotificationRow[];
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-6">
          <Link
            href="/briefs"
            className="flex items-center shrink-0"
          >
            <Image
              src="https://storage.googleapis.com/boulderscss/logo-flat-white.png"
              alt="Boulders"
              width={120}
              height={32}
              className="h-6 w-auto"
              priority
            />
          </Link>

          <nav className="flex items-center gap-1 overflow-visible">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-brand"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger
                className={`relative px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                  isProfileActive
                    ? "text-brand"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center justify-center w-5 h-5">
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
                      d="M5.121 17.804A9.963 9.963 0 0112 15c2.53 0 4.84.94 6.879 2.485M15 9a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </span>
                <svg
                  className="w-3.5 h-3.5 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-surface border-border">
                {profileItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/profile" && pathname.startsWith(item.href));
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      className={isActive ? "text-brand" : ""}
                      onClick={() => router.push(item.href)}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
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

            {isAdmin && (
              <Link
                href="/admin"
                className={`ml-1 px-3 py-1.5 rounded-md text-sm font-medium border border-accent/40 text-accent hover:bg-accent hover:text-background transition-all whitespace-nowrap ${
                  adminChecked ? "opacity-100" : "opacity-0"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
