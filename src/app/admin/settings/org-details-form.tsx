"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgDetails, uploadOrgLogo } from "./org-actions";

type OrgTab = "identity" | "brand" | "legal";

interface Props {
  /** Which tab the surrounding page is rendering. The form keeps a
   *  single source of truth for state so values persist across tab
   *  switches; only the visible section changes. */
  activeTab: OrgTab;
  /** Org id is needed for the discoverability toggle on the Identity
   *  tab — it talks to a separate server action that flips just the
   *  bool without touching the rest of the form state. */
  orgId: string;
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

export function OrgDetailsForm({ activeTab, orgId, org }: Props) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? "");
  const [accentColor, setAccentColor] = useState(org.accent_color ?? "#C8FF00");
  const [contactEmail, setContactEmail] = useState(org.contact_email ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [cvr, setCvr] = useState(org.cvr ?? "");
  const [vatNumber, setVatNumber] = useState(org.vat_number ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  function handleLogoUpload(file: File) {
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);

    startUpload(async () => {
      const result = await uploadOrgLogo(formData);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setLogoUrl(result.url);
      router.refresh();
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    start(async () => {
      const result = await updateOrgDetails({
        name: name.trim(),
        description: description.trim() || undefined,
        industry: industry.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        accent_color: accentColor.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        address: address.trim() || undefined,
        cvr: cvr.trim() || undefined,
        vat_number: vatNumber.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface border border-border rounded-xl p-6 space-y-6"
    >
      {activeTab === "identity" && (
        <div className="space-y-6">
          <Section
            title="Identity"
            description="How your org appears to creators on /discover, in emails, and on invoices. Slug is fixed after creation."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Labelled label="Display name">
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </Labelled>
              <Labelled label="Slug (read-only)">
                <input
                  type="text"
                  value={org.slug}
                  disabled
                  className="input font-mono opacity-60 cursor-not-allowed"
                />
              </Labelled>
            </div>
            <Labelled label="Description (used on /discover)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What does your org do? Who do you typically commission content for?"
                className="input"
              />
            </Labelled>
            <Labelled label="Industry">
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. fitness, fashion, SaaS"
                className="input"
              />
            </Labelled>
          </Section>

          <DiscoverabilityRow
            orgId={orgId}
            initial={org.discoverable}
            description={description}
          />
        </div>
      )}

      {activeTab === "brand" && (
        <Section
          title="Brand kit"
          description="Org-level visual identity. Logos, palette, typography, and guidelines live on the dedicated /admin/brand surface."
        >
          <div className="space-y-3">
            <span className="block text-xs uppercase tracking-wider text-muted">
              Logo
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            {logoUrl ? (
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
                    src={logoUrl}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <p className="flex-1 text-sm text-muted">Logo uploaded</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md text-muted hover:text-foreground hover:bg-surface-hover disabled:opacity-50 transition-colors"
                  >
                    {uploading ? "Uploading…" : "Replace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    disabled={uploading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md text-muted hover:text-error hover:bg-surface-hover transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                disabled={uploading}
                className={`w-full flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-lg border-2 border-dashed transition-colors disabled:opacity-50 ${
                  dragActive
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-border-strong hover:bg-surface-hover"
                }`}
              >
                <svg
                  className="w-8 h-8 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm font-medium">
                  {uploading ? "Uploading…" : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted">
                  PNG, JPEG, SVG, or WebP · up to 2 MB
                </p>
              </button>
            )}
            {uploadError && (
              <p className="text-xs text-error">{uploadError}</p>
            )}
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {showUrlInput ? "Hide URL field" : "Or use an external URL →"}
            </button>
            {showUrlInput && (
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://cdn.example.com/logo.svg"
                className="input font-mono text-xs"
              />
            )}
          </div>
          <Labelled label="Accent color">
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 bg-background border border-border rounded cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#C8FF00"
                className="input font-mono flex-1"
              />
            </div>
          </Labelled>
        </Section>
      )}

      {activeTab === "legal" && (
        <Section
          title="Contact & legal"
          description="Used on invoices and creator-visible contact details."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Labelled label="Contact email (shown publicly)">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@acme.com"
                className="input"
              />
            </Labelled>
            <Labelled label="CVR / business reg. number">
              <input
                type="text"
                value={cvr}
                onChange={(e) => setCvr(e.target.value)}
                className="input font-mono"
              />
            </Labelled>
            <Labelled label="VAT number">
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                className="input font-mono"
              />
            </Labelled>
          </div>
          <Labelled label="Address (multi-line)">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Street, city, postal code, country"
              className="input"
            />
          </Labelled>
        </Section>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-success text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors text-sm"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--background);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-family: inherit;
        }
        .input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        textarea.input {
          resize: vertical;
          min-height: 4rem;
        }
      `}</style>
    </form>
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

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Inline discoverability toggle that lives inside the Identity tab.
 * Talks to its own server action so flipping the bool doesn't bundle
 * with the rest of the form's "Save changes" path — admins should be
 * able to flip discovery on/off without committing other unsaved edits.
 *
 * Renders a "missing description" warning when discoverability is on
 * but the description input is empty (the feature is mostly useless
 * without a discover blurb).
 */
function DiscoverabilityRow({
  initial,
  description,
}: {
  orgId: string;
  initial: boolean;
  description: string;
}) {
  const [discoverable, setDiscoverable] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    const result = await updateOrgDetails({ discoverable: !discoverable });
    if (result.ok) {
      setDiscoverable(!discoverable);
    }
    setSaving(false);
  }

  return (
    <div className="border-t border-border pt-6 space-y-3">
      <header>
        <h3 className="text-base font-semibold">Creator discovery</h3>
        <p className="text-muted text-sm mt-0.5">
          When on, your org appears on /discover where creators can find you
          and apply to join your roster.
        </p>
      </header>

      <div className="bg-background border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">
              {discoverable ? "Discoverable" : "Hidden"}
            </p>
            <p className="text-sm text-muted mt-0.5">
              {discoverable
                ? "Creators can find and apply to your organization"
                : "Only invite codes can add creators to your roster"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            aria-pressed={discoverable}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              discoverable ? "bg-accent" : "bg-border"
            } ${saving ? "opacity-50" : ""}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                discoverable ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        {discoverable && !description.trim() && (
          <p className="text-sm text-warning mt-3">
            Add a description above so creators know what you do.
          </p>
        )}
      </div>
    </div>
  );
}
