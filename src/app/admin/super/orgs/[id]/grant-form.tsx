"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantOrgOverride } from "./actions";

type Kind = "fee_bp" | "plan" | "feature_flag" | "limit" | "trial_extension";

const FEATURE_KEYS = ["analytics", "custom_branding", "discovery_boost"];
const LIMIT_KEYS = ["max_active_briefs", "max_creators"];

export function GrantOverrideForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("fee_bp");
  const [feeBp, setFeeBp] = useState("0");
  const [planSlug, setPlanSlug] = useState("pro");
  const [featureKey, setFeatureKey] = useState(FEATURE_KEYS[0]);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [limitKey, setLimitKey] = useState(LIMIT_KEYS[0]);
  const [limitValue, setLimitValue] = useState("");
  const [trialDays, setTrialDays] = useState("14");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buildValue(): Record<string, unknown> | string {
    switch (kind) {
      case "fee_bp": {
        const bp = parseInt(feeBp, 10);
        if (!Number.isFinite(bp) || bp < 0 || bp > 10000) {
          return "fee_bp must be 0-10000 (basis points)";
        }
        return { fee_bp: bp };
      }
      case "plan":
        if (!planSlug.trim()) return "Plan slug is required";
        return { plan_slug: planSlug.trim() };
      case "feature_flag":
        return { key: featureKey, enabled: featureEnabled };
      case "limit": {
        const trimmed = limitValue.trim();
        const value = trimmed === "" ? null : parseInt(trimmed, 10);
        if (trimmed !== "" && !Number.isFinite(value as number)) {
          return "Limit value must be a number or empty (unlimited)";
        }
        return { key: limitKey, value };
      }
      case "trial_extension": {
        const days = parseInt(trialDays, 10);
        if (!Number.isFinite(days) || days <= 0) return "Days must be > 0";
        return { days };
      }
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const built = buildValue();
    if (typeof built === "string") {
      setError(built);
      return;
    }

    start(async () => {
      const result = await grantOrgOverride({
        orgId,
        kind,
        value: built,
        reason: reason.trim(),
        expiresAt: expiresAt || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason("");
      setExpiresAt("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface border border-border rounded-xl p-5 space-y-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="input"
          >
            <option value="fee_bp">Fee rate (bp)</option>
            <option value="plan">Switch plan</option>
            <option value="feature_flag">Feature flag</option>
            <option value="limit">Limit</option>
            <option value="trial_extension">Trial extension</option>
          </select>
        </Labelled>

        {kind === "fee_bp" && (
          <Labelled label="Fee in basis points (500 = 5%, 0 = waive)">
            <input
              type="number"
              min={0}
              max={10000}
              value={feeBp}
              onChange={(e) => setFeeBp(e.target.value)}
              className="input"
            />
          </Labelled>
        )}

        {kind === "plan" && (
          <Labelled label="Plan slug">
            <input
              type="text"
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              className="input font-mono"
            />
          </Labelled>
        )}

        {kind === "feature_flag" && (
          <>
            <Labelled label="Feature">
              <select
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                className="input"
              >
                {FEATURE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Enabled">
              <select
                value={featureEnabled ? "yes" : "no"}
                onChange={(e) => setFeatureEnabled(e.target.value === "yes")}
                className="input"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Labelled>
          </>
        )}

        {kind === "limit" && (
          <>
            <Labelled label="Limit">
              <select
                value={limitKey}
                onChange={(e) => setLimitKey(e.target.value)}
                className="input"
              >
                {LIMIT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Value (blank = unlimited)">
              <input
                type="number"
                min={0}
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                className="input"
                placeholder="e.g. 10"
              />
            </Labelled>
          </>
        )}

        {kind === "trial_extension" && (
          <Labelled label="Days to extend">
            <input
              type="number"
              min={1}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="input"
            />
          </Labelled>
        )}

        <Labelled label="Expires (optional, blank = forever)">
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="input"
          />
        </Labelled>
      </div>

      <Labelled label="Reason (logged)">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
          placeholder="e.g. Partner deal — 2026 launch"
          className="input"
        />
      </Labelled>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors text-sm"
        >
          {pending ? "Granting…" : "Grant override"}
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
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
