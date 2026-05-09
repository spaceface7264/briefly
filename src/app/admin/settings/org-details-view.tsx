type OrgTab = "identity" | "brand" | "legal";

interface Props {
  /** Which tab the surrounding page is rendering. */
  activeTab: OrgTab;
  org: {
    name: string;
    slug: string;
    description: string | null;
    discoverable: boolean;
    industry: string | null;
    logo_url: string | null;
    accent_color: string | null;
    contact_email: string | null;
    address: string | null;
    cvr: string | null;
    vat_number: string | null;
  };
}

/**
 * Read-only view of organisation details for non-admin members.
 *
 * Mirrors the shape of `OrgDetailsForm` but renders every field as
 * static text. Members can see how their org is presented, but cannot
 * change it — that is gated to admins server-side via
 * `requireOrgAdmin()` in `org-actions.ts`. Mirroring the gate in the
 * UI keeps members from bumping into "Admin access required" errors.
 */
export function OrgDetailsView({ activeTab, org }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-end mb-2">
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
          Admin only
        </span>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        {activeTab === "identity" && (
          <>
            <Section
              title="Identity"
              description="How your org appears to creators on /discover, in emails, and on invoices."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Display name" value={org.name} />
                <Field label="Slug" value={org.slug} mono />
              </div>
              <Field
                label="Description"
                value={org.description}
                placeholder="No description set"
                multiline
              />
              <Field
                label="Industry"
                value={org.industry}
                placeholder="Not specified"
              />
            </Section>

            <div className="border-t border-border pt-6 space-y-3">
              <header>
                <h3 className="text-base font-semibold">Creator discovery</h3>
                <p className="text-muted text-sm mt-0.5">
                  Whether your org appears on /discover for creators to find.
                </p>
              </header>
              <div className="bg-background border border-border rounded-lg p-4">
                <p className="font-medium">
                  {org.discoverable ? "Discoverable" : "Hidden"}
                </p>
                <p className="text-sm text-muted mt-0.5">
                  {org.discoverable
                    ? "Creators can find and apply to your organization."
                    : "Only invite codes can add creators to your roster."}
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === "brand" && (
          <Section
            title="Brand kit"
            description="Org-level visual identity. The full brand kit (palette, typography, guidelines) lives at /admin/brand."
          >
            <div className="space-y-3">
              <span className="block text-xs uppercase tracking-wider text-muted">
                Logo
              </span>
              {org.logo_url ? (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border">
                  <div
                    className="shrink-0 w-16 h-16 rounded-lg border border-border flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%)",
                      backgroundSize: "12px 12px",
                      backgroundPosition: "0 0, 6px 6px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={org.logo_url}
                      alt={`${org.name} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="flex-1 text-sm text-muted truncate">
                    {org.logo_url}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted italic">No logo uploaded</p>
              )}
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                Accent color
              </span>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-14 rounded border border-border"
                  style={{
                    backgroundColor: org.accent_color ?? "#09D7D7",
                  }}
                  aria-hidden
                />
                <span className="font-mono text-sm">
                  {org.accent_color ?? "#09D7D7"}
                </span>
              </div>
            </div>
          </Section>
        )}

        {activeTab === "legal" && (
          <Section
            title="Contact & legal"
            description="Used on invoices and creator-visible contact details."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Contact email"
                value={org.contact_email}
                placeholder="Not set"
              />
              <Field
                label="CVR / business reg. number"
                value={org.cvr}
                placeholder="Not set"
                mono
              />
              <Field
                label="VAT number"
                value={org.vat_number}
                placeholder="Not set"
                mono
              />
            </div>
            <Field
              label="Address"
              value={org.address}
              placeholder="No address set"
              multiline
            />
          </Section>
        )}
      </div>
    </section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-muted text-sm mt-0.5">{description}</p>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder = "—",
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const trimmed = value?.trim();
  const isEmpty = !trimmed;
  return (
    <div>
      <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
        {label}
      </span>
      <p
        className={[
          "text-sm",
          mono ? "font-mono" : "",
          multiline ? "whitespace-pre-line" : "",
          isEmpty ? "italic text-muted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isEmpty ? placeholder : trimmed}
      </p>
    </div>
  );
}
