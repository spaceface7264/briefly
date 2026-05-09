import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, getOrgRole } from "@/lib/org";
import { redirect } from "next/navigation";
import { OrgDetailsForm } from "../settings/org-details-form";
import { OrgDetailsView } from "../settings/org-details-view";

export const dynamic = "force-dynamic";

type OrgTab = "identity" | "brand" | "legal";

const TABS: { id: OrgTab; label: string; description: string }[] = [
  {
    id: "identity",
    label: "Identity",
    description:
      "Display name, description, industry, and your visibility on /discover.",
  },
  {
    id: "brand",
    label: "Brand kit",
    description: "Logo and accent color used across briefs and emails.",
  },
  {
    id: "legal",
    label: "Legal",
    description: "Contact email, address, and tax registration numbers.",
  },
];

export default async function AdminOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab: OrgTab =
    params.tab === "brand" || params.tab === "legal" ? params.tab : "identity";
  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

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
  // Platform admins in support mode have no membership row, so the
  // direct lookup misses them, fall through to getOrgRole, which is
  // support-mode aware.
  const isAdmin =
    myMembership?.role === "admin" ||
    (await getOrgRole(supabase)) === "admin";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display tracking-tight text-3xl font-bold mb-2">Organization</h1>
        <p className="text-muted">{activeTabMeta.description}</p>
      </div>

      {/* Tab strip. URL-based state (?tab=brand, ?tab=legal) so each
          surface is linkable. Default tab keeps the URL clean by
          omitting the param. Form state inside OrgDetailsForm
          persists across tab switches because the client component
          stays mounted between server re-renders. */}
      <div className="mb-8 border-b border-border">
        <nav
          className="flex gap-1 -mb-px"
          aria-label="Organization sections"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const href =
              tab.id === "identity"
                ? "/admin/organization"
                : `/admin/organization?tab=${tab.id}`;
            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {org &&
        (isAdmin ? (
          <OrgDetailsForm
            activeTab={activeTab}
            orgId={orgId}
            org={{
              name: org.name,
              slug: org.slug,
              description: org.description,
              discoverable: org.discoverable,
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
            activeTab={activeTab}
            org={{
              name: org.name,
              slug: org.slug,
              description: org.description,
              discoverable: org.discoverable,
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
    </div>
  );
}
