"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { StatusPill } from "@/components/status-pill";
import {
  createTeammateInvite,
  revokeTeammateInvite,
} from "./team-invite-actions";

export interface TeammateInvite {
  id: string;
  code: string;
  role: string;
  created_at: string;
  expires_at: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  /** Server-side computed: true when expires_at is in the past.
   *  Computed on the server so client render stays pure. */
  is_expired: boolean;
}

export interface RedeemedInvite {
  id: string;
  code: string;
  role: string;
  used_at: string | null;
  redeemed_by_name: string | null;
  redeemed_by_email: string | null;
}

interface Props {
  invites: TeammateInvite[];
  /** Recently-redeemed teammate invites (most recent 20). Reference-only —
   *  shown collapsed under the active table so admins can audit who joined
   *  via which code without crowding the actionable list. */
  redeemedInvites: RedeemedInvite[];
  /** Disables the "Send invite" affordance for non-admins (i.e. members). */
  canManage: boolean;
}

const EXPIRY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "Never", value: null as number | null },
];

function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  if (role === "creator") return "Creator";
  return role;
}

function formatRedeemedAt(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB");
}

function formatExpiry(value: string | null, expired: boolean): string {
  if (!value) return "Never";
  if (expired) return "Expired";
  return new Date(value).toLocaleDateString("en-GB");
}

export function TeamInvites({ invites, redeemedInvites, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [created, setCreated] = useState<{ code: string; role: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setOpen(false);
    setTimeout(() => {
      setRole("member");
      setExpiresInDays(30);
      setCreated(null);
      setError(null);
      setCopied(false);
    }, 200);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createTeammateInvite({ role, expiresInDays });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({ code: result.code, role });
      router.refresh();
    });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRevoke(inviteId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeTeammateInvite(inviteId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const showResult = created !== null;
  const activeInvites = invites.filter((i) => !i.is_expired);
  const archivedInvites = invites.filter((i) => i.is_expired);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Teammate invites</h2>
          <p className="text-muted text-sm">
            Send a single-use code to add an admin or member to this org.
            Recipients sign up with the code and join automatically.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
          >
            Send invite
          </button>
        )}
      </div>

      {!canManage && (
        <p className="text-muted text-xs">
          Only admins can issue invites. Ask an admin if you need to add
          someone.
        </p>
      )}

      {error && !open && (
        <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
          <svg
            className="w-4 h-4 text-error shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
            />
          </svg>
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      {activeInvites.length === 0 && archivedInvites.length === 0 ? (
        <div className="bg-surface border border-border border-dashed rounded-xl p-6 text-center">
          <p className="text-muted text-sm">
            No teammate invites yet.
            {canManage && " Click \u201cSend invite\u201d to create one."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-raised">
              <tr>
                <Th>Code</Th>
                <Th>Role</Th>
                <Th>Expires</Th>
                <Th>Issued by</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {activeInvites.map((invite) => (
                <tr
                  key={invite.id}
                  className="border-t border-border"
                >
                  <Td>
                    <code className="font-mono text-sm tracking-wider">
                      {invite.code}
                    </code>
                  </Td>
                  <Td>
                    <StatusPill
                      tone={invite.role === "admin" ? "info" : "neutral"}
                      dot={false}
                    >
                      {roleLabel(invite.role)}
                    </StatusPill>
                  </Td>
                  <Td className="text-muted font-mono text-sm">
                    {formatExpiry(invite.expires_at, invite.is_expired)}
                  </Td>
                  <Td className="text-muted text-sm">
                    {invite.created_by_name || invite.created_by_email || "—"}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => copyCode(invite.code)}
                        className="px-3 py-1 text-xs text-muted hover:text-foreground rounded-md transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(invite.id)}
                        disabled={pending}
                        className="px-3 py-1 text-xs text-muted hover:text-error rounded-md transition-colors disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
              {archivedInvites.map((invite) => (
                <tr
                  key={invite.id}
                  className="border-t border-border opacity-60"
                >
                  <Td>
                    <code className="font-mono text-sm tracking-wider line-through">
                      {invite.code}
                    </code>
                  </Td>
                  <Td>
                    <StatusPill tone="neutral" dot={false}>
                      {roleLabel(invite.role)}
                    </StatusPill>
                  </Td>
                  <Td className="text-muted font-mono text-sm">
                    Expired
                  </Td>
                  <Td className="text-muted text-sm">
                    {invite.created_by_name || invite.created_by_email || "—"}
                  </Td>
                  {canManage && <Td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Redeemed history — collapsed by default. Reference info only;
          there's nothing to act on, so we hide it behind a disclosure to
          keep the active table the focal point. Native <details> keeps
          this dependency-free and accessible without extra JS. */}
      {redeemedInvites.length > 0 && (
        <details className="bg-surface border border-border rounded-xl overflow-hidden group">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-muted hover:text-foreground hover:bg-surface-raised transition-colors flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
            <span>
              Redeemed{" "}
              <span className="text-xs text-muted ml-1">
                ({redeemedInvites.length})
              </span>
            </span>
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <div className="border-t border-border">
            <table className="w-full">
              <thead className="bg-surface-raised">
                <tr>
                  <Th>Code</Th>
                  <Th>Role</Th>
                  <Th>Redeemed by</Th>
                  <Th>Redeemed at</Th>
                </tr>
              </thead>
              <tbody>
                {redeemedInvites.map((invite) => (
                  <tr key={invite.id} className="border-t border-border">
                    <Td>
                      <code className="font-mono text-sm tracking-wider text-muted">
                        {invite.code}
                      </code>
                    </Td>
                    <Td>
                      <StatusPill
                        tone={invite.role === "admin" ? "info" : "neutral"}
                        dot={false}
                      >
                        {roleLabel(invite.role)}
                      </StatusPill>
                    </Td>
                    <Td className="text-sm">
                      {invite.redeemed_by_name ||
                        invite.redeemed_by_email ||
                        "—"}
                    </Td>
                    <Td className="text-muted font-mono text-sm">
                      {formatRedeemedAt(invite.used_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <Modal
        open={open}
        onClose={() => !pending && reset()}
        title={showResult ? "Invite ready" : "Invite a teammate"}
        description={
          showResult
            ? `Share this code with the new ${roleLabel(created!.role).toLowerCase()}. It works once.`
            : "Pick a role and how long the code stays valid."
        }
        size="sm"
        footer={
          showResult ? (
            <>
              <button
                type="button"
                onClick={() => copyCode(created!.code)}
                className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={pending}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
              >
                {pending ? "Creating…" : "Create invite"}
              </button>
            </>
          )
        }
      >
        {showResult ? (
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-2">Single-use invite code</p>
            <p className="font-mono text-2xl tracking-[0.25em] text-accent">
              {created!.code}
            </p>
            <p className="text-xs text-muted mt-3">
              Recipient signs up at /login → toggles &ldquo;I have an invite
              code&rdquo; → enters this code.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <RoleOption
                  label="Member"
                  description="Day-to-day access — review submissions, manage briefs."
                  selected={role === "member"}
                  onSelect={() => setRole("member")}
                />
                <RoleOption
                  label="Admin"
                  description="Everything members do, plus billing, team, and settings."
                  selected={role === "admin"}
                  onSelect={() => setRole("admin")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="teammate-expiry"
                className="block text-sm font-medium mb-2"
              >
                Expires in
              </label>
              <select
                id="teammate-expiry"
                value={expiresInDays ?? "never"}
                onChange={(ev) =>
                  setExpiresInDays(
                    ev.target.value === "never"
                      ? null
                      : parseInt(ev.target.value, 10)
                  )
                }
                className="w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option
                    key={opt.label}
                    value={opt.value === null ? "never" : opt.value}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}

function RoleOption({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-3 rounded-lg border transition-colors ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted mt-1">{description}</p>
    </button>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left text-xs font-medium text-muted px-4 py-3 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
