interface Props {
  org: {
    name: string;
    slug: string;
    description: string | null;
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
export function OrgDetailsView({ org }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Organisation</h2>
          <p className="text-muted text-sm">
            How your org appears to creators on /discover, in emails, and on
            invoices.
          </p>
        </div>
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

      <div className="bg-surface border border-border rounded-xl p-5 space-y-6">
        <Section title="Identity">
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

        <Section title="Branding">
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                Accent color
              </span>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-14 rounded border border-border"
                  style={{
                    backgroundColor: org.accent_color ?? "#C8FF00",
                  }}
                  aria-hidden
                />
                <span className="font-mono text-sm">
                  {org.accent_color ?? "#C8FF00"}
                </span>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Contact & legal">
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
      </div>
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">
        {title}
      </h3>
      {children}
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
