import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, getOrgRole } from "@/lib/org";
import { ApplicationList, type Application } from "./application-list";

export default async function AdminApplicationsPage() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);
  const role = await getOrgRole(supabase);
  const canDecide = role === "admin";

  const { data } = await supabase
    .from("org_applications")
    .select(
      "id, message, status, created_at, reviewed_at, applicant:profiles!org_applications_user_id_fkey(id, name, email, social_handles)"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const applications = (data ?? []) as unknown as Application[];
  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display tracking-tight text-3xl font-bold mb-1">Applications</h1>
          <p className="text-muted">
            {pending.length} pending application
            {pending.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!canDecide && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-raised border border-border text-xs text-muted">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Approval is admin only
          </span>
        )}
      </div>

      <ApplicationList
        pending={pending}
        reviewed={reviewed}
        canDecide={canDecide}
      />
    </div>
  );
}
