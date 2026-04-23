"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/profile", label: "Profile" },
  { href: "/profile/payouts", label: "Payouts" },
  { href: "/profile/invoices", label: "Invoices" },
  { href: "/profile/notifications", label: "Notifications" },
];

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/profile"
            ? pathname === "/profile"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              isActive
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
