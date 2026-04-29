"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformLogo } from "@/components/platform-logo";

const tabs = [
  { href: "/admin/super", label: "Overview" },
  { href: "/admin/super/orgs", label: "Orgs" },
  { href: "/admin/super/platform", label: "Platform" },
  { href: "/admin/super/audit", label: "Audit log" },
];

export function SuperHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/super" className="flex items-center gap-2">
              <PlatformLogo className="h-6 w-auto" width={100} height={28} />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                Platform
              </span>
            </Link>
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/admin/super"
                  ? pathname === "/admin/super"
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center">
            <Link
              href="/admin"
              className="text-sm text-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              ← Back to admin
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
