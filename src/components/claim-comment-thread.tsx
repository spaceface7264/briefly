"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import {
  listClaimComments,
  addClaimComment,
  type ClaimComment,
} from "@/app/admin/(org)/claims/review-actions";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Threaded comments on a claim, viewable + postable by both the
 * creator (their own claim) and active org members. Used inside the
 * org-side review modal and the creator-side brief detail page.
 *
 * Refreshes its list on mount and after each successful post. The
 * server actions revalidate the relevant routes, so neighbouring
 * status badges update on the next navigation.
 */
export function ClaimCommentThread({
  claimId,
  viewerRole,
}: {
  claimId: string;
  /** How to label the "post" button copy and decorate own messages. */
  viewerRole: "org" | "creator";
}) {
  const [comments, setComments] = useState<ClaimComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, startPosting] = useTransition();

  async function refresh() {
    setLoadError(null);
    const result = await listClaimComments(claimId);
    if (result.ok) {
      setComments(result.comments);
    } else {
      setLoadError(result.error);
    }
  }

  useEffect(() => {
    // Mount-time fetch. The setState happens inside an async
    // callback, not the effect body itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // refresh is stable for a given claimId; intentionally not
    // listing it as a dep to avoid re-fetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  function handlePost() {
    const body = draft.trim();
    if (!body) return;
    startPosting(async () => {
      const result = await addClaimComment(claimId, body);
      if (!result.ok) {
        toast.error("Couldn't post comment", { description: result.error });
        return;
      }
      setDraft("");
      await refresh();
    });
  }

  return (
    <div className="space-y-3">
      {loadError && <p className="text-sm text-error">{loadError}</p>}

      {comments && comments.length === 0 && (
        <p className="text-sm text-muted">No comments yet.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} viewerRole={viewerRole} />
          ))}
        </ul>
      )}

      {!comments && !loadError && (
        <p className="text-sm text-muted">Loading…</p>
      )}

      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={
            viewerRole === "org"
              ? "Add a note for the creator…"
              : "Reply to the org…"
          }
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent resize-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-background disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  viewerRole,
}: {
  comment: ClaimComment;
  viewerRole: "org" | "creator";
}) {
  const isOwn = comment.author_role === viewerRole;
  const authorLabel =
    comment.author_name ||
    comment.author_email ||
    (comment.author_role === "org" ? "Org" : "Creator");
  const sideLabel = comment.author_role === "org" ? "Org" : "Creator";

  return (
    <li
      className={`border rounded-lg p-3 ${
        isOwn
          ? "bg-surface-raised border-border"
          : comment.author_role === "org"
            ? "bg-info/5 border-info/20"
            : "bg-accent/5 border-accent/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar
          url={comment.author_avatar_url}
          name={comment.author_name}
          email={comment.author_email}
          size="sm"
          alt=""
        />
        <span className="text-sm font-medium truncate">{authorLabel}</span>
        <span className="text-xs text-muted shrink-0">· {sideLabel}</span>
        <span className="ml-auto text-xs text-muted font-mono shrink-0">
          {formatTimestamp(comment.created_at)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap text-foreground">
        {comment.body}
      </p>
    </li>
  );
}
