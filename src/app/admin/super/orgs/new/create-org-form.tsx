"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrg } from "./actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState("DKK");
  const [country, setCountry] = useState("DK");
  const [discoverable, setDiscoverable] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [setActiveOrg, setSetActiveOrg] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const result = await createOrg({
        slug: effectiveSlug,
        name,
        currency,
        country,
        discoverable,
        adminEmail,
        setActiveOrg,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/super/orgs/${result.orgId}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface border border-border rounded-xl p-6 space-y-5 max-w-2xl"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Display name">
          <input
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            className="input"
          />
        </Labelled>

        <Labelled label="Slug (URL-safe)">
          <input
            type="text"
            required
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="acme"
            className="input font-mono"
          />
        </Labelled>

        <div>
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
            Currency
          </span>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DKK">DKK</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="SEK">SEK</SelectItem>
              <SelectItem value="NOK">NOK</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
            Country
          </span>
          <Select value={country} onValueChange={(v) => v && setCountry(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DK">Denmark</SelectItem>
              <SelectItem value="SE">Sweden</SelectItem>
              <SelectItem value="NO">Norway</SelectItem>
              <SelectItem value="FI">Finland</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="NL">Netherlands</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Labelled label="Initial admin email (must already have an account)">
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="founder@acme.com"
          className="input"
        />
      </Labelled>

      <div className="space-y-3 border-t border-border pt-5">
        <Checkbox
          checked={discoverable}
          onChange={setDiscoverable}
          label="Show on /discover"
          hint="Creators without an invite can apply to join. Toggle later in /admin/settings."
        />
        <Checkbox
          checked={setActiveOrg}
          onChange={setSetActiveOrg}
          label="Set as the new admin's active org (if they have none)"
          hint="Recommended. The user will land here after their next sign-in."
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/admin/super/orgs")}
          className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors text-sm"
        >
          {pending ? "Creating…" : "Create organisation"}
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
        }
        .input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
      `}</style>
    </form>
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

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
