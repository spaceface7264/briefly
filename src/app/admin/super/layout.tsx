import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/pricing-server";
import { SuperHeader } from "./super-header";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) redirect("/");

  return (
    <>
      <SuperHeader />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </>
  );
}
