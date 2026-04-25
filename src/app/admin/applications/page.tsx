import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { ApplicationList } from "./application-list";

export default async function AdminApplicationsPage() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);

  const { data: applications } = await supabase
    .from("org_applications")
    .select(
      "id, message, status, created_at, reviewed_at, applicant:profiles!org_applications_user_id_fkey(id, name, email, instagram_handle)"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const pending = (applications || []).filter((a: any) => a.status === "pending");
  const reviewed = (applications || []).filter((a: any) => a.status !== "pending");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Applications</h1>
        <p className="text-muted">
          {pending.length} pending application{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ApplicationList pending={pending} reviewed={reviewed} />
    </div>
  );
}
