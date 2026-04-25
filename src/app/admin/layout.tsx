import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin of active org via membership
  const orgId = await requireActiveOrg(supabase);
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (membership?.role !== "admin") {
    redirect("/briefs");
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 ml-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
