import { LockIcon } from "lucide-react";
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
      "id, message, status, created_at, reviewed_at, applicant:profiles!org_applications_user_id_fkey(id, name, email, avatar_url, bio, country, languages, skills, social_handles)"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const applications = (data ?? []) as unknown as Application[];
  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Applications
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pending.length > 0
              ? `${pending.length} awaiting review`
              : "Nothing waiting on you"}
            {reviewed.length > 0 && (
              <span className="text-muted">
                {" · "}
                {reviewed.length} reviewed
              </span>
            )}
          </p>
        </div>
        {!canDecide && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 text-xs text-muted">
            <LockIcon className="h-3.5 w-3.5" />
            Approval is admin only
          </span>
        )}
      </header>

      <ApplicationList
        pending={pending}
        reviewed={reviewed}
        canDecide={canDecide}
      />
    </div>
  );
}
