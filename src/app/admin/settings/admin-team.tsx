"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, Modal } from "@/components/modal";
import { StatusPill } from "@/components/status-pill";
import { promoteToAdmin, demoteFromAdmin } from "./actions";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
}

interface AdminTeamProps {
  admins: TeamMember[];
  creators: TeamMember[];
  currentUserId: string;
}

export function AdminTeam({ admins, creators, currentUserId }: AdminTeamProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<string>("");

  const [demoteTarget, setDemoteTarget] = useState<TeamMember | null>(null);

  const isLastAdmin = admins.length <= 1;

  function resetPromote() {
    setPromoteOpen(false);
    setSelectedCreator("");
    setError(null);
  }

  function handlePromote() {
    if (!selectedCreator) {
      setError("Pick a creator to promote");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await promoteToAdmin(selectedCreator);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetPromote();
      router.refresh();
    });
  }

  function handleDemote() {
    if (!demoteTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await demoteFromAdmin(demoteTarget.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDemoteTarget(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Admin team</h2>
          <p className="text-muted text-sm">
            {admins.length} admin{admins.length !== 1 ? "s" : ""} · at least one
            admin must always remain
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPromoteOpen(true)}
          disabled={creators.length === 0}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background text-sm font-semibold rounded-lg transition-colors"
        >
          Add admin
        </button>
      </div>

      {error && !promoteOpen && !demoteTarget && (
        <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
          <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <p className="text-error text-sm">{error}</p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-raised">
              <th className="text-left text-xs font-medium text-muted px-4 py-3 uppercase tracking-wider">
                Admin
              </th>
              <th className="text-left text-xs font-medium text-muted px-4 py-3 uppercase tracking-wider">
                Since
              </th>
              <th className="text-right text-xs font-medium text-muted px-4 py-3 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const isSelf = admin.id === currentUserId;
              return (
                <tr
                  key={admin.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {admin.name || "No name"}
                          </p>
                          {isSelf && (
                            <StatusPill tone="info" dot={false}>
                              You
                            </StatusPill>
                          )}
                        </div>
                        <p className="text-muted text-sm truncate">
                          {admin.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-sm">
                    {new Date(admin.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDemoteTarget(admin)}
                      disabled={isSelf || isLastAdmin || pending}
                      title={
                        isSelf
                          ? "You cannot remove your own admin access"
                          : isLastAdmin
                            ? "At least one admin must remain"
                            : undefined
                      }
                      className="px-3 py-1.5 text-sm text-muted hover:text-error hover:bg-error-muted disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      Remove access
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={promoteOpen}
        onClose={() => !pending && resetPromote()}
        title="Promote creator to admin"
        description="Admins can manage briefs, approve submissions, pay claims, and manage the admin team."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={resetPromote}
              disabled={pending}
              className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePromote}
              disabled={pending || !selectedCreator}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
            >
              {pending ? "Promoting..." : "Promote to admin"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="creator"
              className="block text-sm font-medium mb-2"
            >
              Creator
            </label>
            <select
              id="creator"
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Pick a creator…</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name ? `${creator.name} (${creator.email})` : creator.email}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
              <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={demoteTarget !== null}
        onClose={() => !pending && setDemoteTarget(null)}
        onConfirm={handleDemote}
        title="Remove admin access?"
        description={
          demoteTarget
            ? `${demoteTarget.name || demoteTarget.email} will lose access to the admin dashboard and return to being a regular creator. They can be promoted again later.`
            : ""
        }
        confirmLabel="Remove access"
        tone="danger"
        loading={pending}
      />
    </section>
  );
}
