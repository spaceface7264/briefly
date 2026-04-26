import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { requirePlatformAdmin } from "@/lib/pricing-server";

const tabs = [
  { href: "/admin/super", label: "Overview" },
  { href: "/admin/super/orgs", label: "Orgs" },
  { href: "/admin/super/audit", label: "Audit log" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) redirect("/");

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-2">
              Platform admin
            </p>
            <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-muted hover:text-foreground transition-colors -mb-px"
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
