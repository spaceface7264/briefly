"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";

export type ClaimComment = {
  id: string;
  body: string;
  author_role: "org" | "creator";
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  author_avatar_url: string | null;
  created_at: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };

type CommentsResult =
  | { ok: true; comments: ClaimComment[] }
  | { ok: false; error: string };

/**
 * Org-side: ask the creator to revise. Posts a comment to the claim
 * thread and flips status from submitted -> revision_requested. The
 * trigger from migration 0054 fires a `claim_revision_requested`
 * notification to the creator; the actual feedback text lives in
 * claim_comments and the creator reads it from the brief detail page.
 *
 * Permissioned via RLS, both admins and members of the org can
 * request changes (matches the existing approve/reject affordance
 * on /admin/claims, which members can also use).
 */
export async function requestRevision(
  claimId: string,
  body: string
): Promise<ActionResult> {
  if (!claimId) return { ok: false, error: "claimId is required" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Feedback is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const orgId = await requireActiveOrg(supabase);

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, status, org_id, brief_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claim) return { ok: false, error: "Claim not found" };
  if (claim.org_id !== orgId) {
    return { ok: false, error: "Claim does not belong to your org" };
  }
  if (claim.status !== "submitted") {
    return {
      ok: false,
      error: `Cannot request changes on a ${claim.status} claim`,
    };
  }

  // Insert the comment first so the creator's notification points
  // at a thread that already has the feedback in it. RLS check
  // ensures the actor is an org member and that author_role matches.
  const { error: commentErr } = await supabase.from("claim_comments").insert({
    claim_id: claim.id,
    author_id: user.id,
    author_role: "org",
    body: trimmed,
  });
  if (commentErr) {
    return { ok: false, error: `Couldn't save feedback: ${commentErr.message}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from("claims") as any)
    .update({ status: "revision_requested" })
    .eq("id", claim.id);
  if (updErr) {
    return { ok: false, error: `Couldn't update claim: ${updErr.message}` };
  }

  revalidatePath("/admin/claims");
  return { ok: true };
}

/**
 * Org-side: terminal reject. Mirrors the previous Reject button,
 * kept for cases where the org wants to walk away from a submission
 * entirely (abuse, off-brief content) rather than ask for revisions.
 * Optionally pins a final comment to the thread.
 */
export async function rejectClaim(
  claimId: string,
  body: string | null
): Promise<ActionResult> {
  if (!claimId) return { ok: false, error: "claimId is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const orgId = await requireActiveOrg(supabase);

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, status, org_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claim) return { ok: false, error: "Claim not found" };
  if (claim.org_id !== orgId) {
    return { ok: false, error: "Claim does not belong to your org" };
  }
  if (claim.status !== "submitted" && claim.status !== "revision_requested") {
    return {
      ok: false,
      error: `Cannot reject a ${claim.status} claim`,
    };
  }

  const trimmed = body?.trim() ?? "";
  if (trimmed) {
    const { error: commentErr } = await supabase.from("claim_comments").insert({
      claim_id: claim.id,
      author_id: user.id,
      author_role: "org",
      body: trimmed,
    });
    if (commentErr) {
      return { ok: false, error: `Couldn't save note: ${commentErr.message}` };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from("claims") as any)
    .update({ status: "cancelled" })
    .eq("id", claim.id);
  if (updErr) {
    return { ok: false, error: `Couldn't update claim: ${updErr.message}` };
  }

  revalidatePath("/admin/claims");
  return { ok: true };
}

/**
 * Add a comment to a claim's thread without changing status. Used by
 * both the creator (e.g. "I made the changes, ready for re-review")
 * and org members posting follow-up notes between status changes.
 * RLS enforces that author_role matches the caller's relationship to
 * the claim.
 */
export async function addClaimComment(
  claimId: string,
  body: string
): Promise<ActionResult> {
  if (!claimId) return { ok: false, error: "claimId is required" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Comment is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, user_id, org_id, brief_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claim) return { ok: false, error: "Claim not found" };

  let authorRole: "org" | "creator";
  if (claim.user_id === user.id) {
    authorRole = "creator";
  } else {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", claim.org_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return { ok: false, error: "Not authorised to comment" };
    }
    authorRole = "org";
  }

  const { error: commentErr } = await supabase.from("claim_comments").insert({
    claim_id: claim.id,
    author_id: user.id,
    author_role: authorRole,
    body: trimmed,
  });
  if (commentErr) {
    return { ok: false, error: `Couldn't save comment: ${commentErr.message}` };
  }

  revalidatePath("/admin/claims");
  revalidatePath(`/briefs/${claim.brief_id}`);
  return { ok: true };
}

/**
 * Read the comment thread for a claim. Joins profiles for author
 * display. RLS already enforces who can read.
 */
export async function listClaimComments(
  claimId: string
): Promise<CommentsResult> {
  if (!claimId) return { ok: false, error: "claimId is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("claim_comments")
    .select(
      "id, body, author_role, author_id, created_at, author:profiles!claim_comments_author_id_fkey(name, email, avatar_url)"
    )
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments: ClaimComment[] = (data || []).map((row: any) => ({
    id: row.id,
    body: row.body,
    author_role: row.author_role,
    author_id: row.author_id,
    author_name: row.author?.name ?? null,
    author_email: row.author?.email ?? null,
    author_avatar_url: row.author?.avatar_url ?? null,
    created_at: row.created_at,
  }));

  return { ok: true, comments };
}
