import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { DiscoverabilityToggle } from "../settings/discoverability-toggle";
import { OrgDetailsForm } from "../settings/org-details-form";
import { OrgDetailsView } from "../settings/org-details-view";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);

  const [{ data: org }, { data: myMembership }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, slug, description, discoverable, industry, logo_url, accent_color, contact_email, address, cvr, vat_number"
      )
      .eq("id", orgId)
      .single(),
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  // Members can VIEW the org page (read-only) but not edit it. Server
  // actions enforce the same gate via `requireOrgAdmin()`; this flag
  // drives the UI choice between editable form and read-only view.
  const isAdmin = myMembership?.role === "admin";

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Organization</h1>
        <p className="text-muted">
          Your org&apos;s identity, branding, and visibility on /discover.
        </p>
      </div>

      <div className="space-y-10">
        {org &&
          (isAdmin ? (
            <OrgDetailsForm
              org={{
                name: org.name,
                slug: org.slug,
                description: org.description,
                industry: org.industry,
                logo_url: org.logo_url,
                accent_color: org.accent_color,
                contact_email: org.contact_email,
                address: org.address,
                cvr: org.cvr,
                vat_number: org.vat_number,
              }}
            />
          ) : (
            <OrgDetailsView
              org={{
                name: org.name,
                slug: org.slug,
                description: org.description,
                industry: org.industry,
                logo_url: org.logo_url,
                accent_color: org.accent_color,
                contact_email: org.contact_email,
                address: org.address,
                cvr: org.cvr,
                vat_number: org.vat_number,
              }}
            />
          ))}

        <DiscoverabilityToggle
          orgId={orgId}
          discoverable={org?.discoverable ?? false}
          orgName={org?.name ?? ""}
          orgDescription={org?.description ?? ""}
          canManage={isAdmin}
        />
      </div>
    </div>
  );
}
