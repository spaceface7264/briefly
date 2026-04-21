"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/briefs", label: "Briefs" },
  { href: "/my-briefs", label: "My Briefs" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
    }
    checkAdmin();
  }, []);

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/briefs" className="font-bold text-lg">
            Boulders <span className="text-accent">Creators</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-background"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className="ml-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-accent text-accent hover:bg-accent hover:text-background"
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
