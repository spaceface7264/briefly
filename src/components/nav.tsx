"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/briefs", label: "Briefs" },
  { href: "/my-briefs", label: "My Briefs" },
  { href: "/guide", label: "Guide" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAdminChecked(true);
        return;
      }

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

          <nav className="flex items-center gap-1 scrollbar-hide overflow-x-auto">
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
                      ? "text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
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
