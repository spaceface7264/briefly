"use client";

import { useState } from "react";
import { AdminNav } from "./admin-nav";

const COOKIE = "admin-sidebar-collapsed";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function AdminShell({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main
        className={`flex-1 min-w-0 transition-[margin] duration-200 ${
          collapsed ? "lg:ml-16" : "lg:ml-64"
        }`}
      >
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
