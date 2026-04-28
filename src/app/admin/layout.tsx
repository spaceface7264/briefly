import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { getAccountType } from "@/lib/account";
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

  // Org-only surface. Creator accounts get bounced to their shell.
  const accountType = await getAccountType(supabase);
  if (accountType !== "org") {
    redirect("/briefs");
  }

  // Org accounts are always tied to exactly one org. Admins and members
  // both land here; member-vs-admin gating is enforced inside the
  // sub-pages and server actions that need it (billing, settings, team).
  const orgId = await requireActiveOrg(supabase);
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
    redirect("/login");
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
