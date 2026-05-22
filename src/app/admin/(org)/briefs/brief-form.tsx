"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  planLimitErrorMessage,
  MIN_TOTAL_ESCROW_DKK,
  MAX_BRIEF_TITLE_LEN,
  formatDkk,
  decidePublishCharge,
  type BriefAllowanceState,
} from "@/lib/pricing";
import {
  createBriefWithEscrow,
  saveBriefDraft,
  updateBriefDraft,
  publishBriefFromDraft,
} from "./actions";
import type { Brief, BriefCategory, BriefDurationClass } from "@/types/database";
import {
  COUNTRIES,
  COUNTRIES_MAX,
  SKILLS,
  SKILLS_MAX,
  countryLabel,
  skillLabel,
} from "@/lib/creator-profile";
import { LanguagePicker } from "@/components/language-picker";

const categories: { value: BriefCategory; label: string }[] = [
  { value: "entertaining", label: "Entertaining" },
  { value: "ad", label: "Ad" },
  { value: "guide", label: "Guide" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
];

const durationClasses: { value: BriefDurationClass; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "static", label: "Static" },
];

// Duration-specific templates with pre-filled defaults. The
// deliverable-specs UI was removed in favour of the prose
// `deliverables` field, but we still keep the templates so existing
// drafts (with structured `deliverable_specs` JSON) round-trip
// through save without losing data.
const durationTemplates: Record<BriefDurationClass, { fields: Record<string, string> }> = {
  short: {
    fields: {
      duration: "15-45 sek",
      aspect_ratio: "9:16",
      captions: "Påkrævet, centreret",
    },
  },
  medium: {
    fields: {
      duration: "45-90 sek",
      aspect_ratio: "9:16",
      captions: "Påkrævet",
    },
  },
  long: {
    fields: {
      duration: "2-10 min",
      aspect_ratio: "16:9",
      captions: "Påkrævet",
      resolution: "1080p minimum",
    },
  },
  static: {
    fields: {
      duration: "N/A",
      aspect_ratio: "Frit",
      resolution: "Min 2000px bred",
      file_format: "JPG eller PNG",
    },
  },
};

type SpecEntry = { key: string; value: string };

function specsToEntries(specs: Record<string, string> | null): SpecEntry[] {
  if (!specs || Object.keys(specs).length === 0) return [];
  return Object.entries(specs).map(([key, value]) => ({ key, value }));
}

function entriesToSpecs(entries: SpecEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const k = entry.key.trim();
    const v = entry.value.trim();
    if (k && v) result[k] = v;
  }
  return result;
}

interface BriefFormProps {
  brief?: Brief;
  /** Whether the org has a saved payment method on file. Drives the
   * "missing payment method" warning + disables the submit button on
   * paid create flows. Edits and zero-price briefs ignore this. */
  hasPaymentMethod?: boolean;
  /** Pricing v2: allowance + overage state for publish-charge preview.
   * Optional so existing callers (the [id] edit page for already-
   * published briefs) keep working without it. */
  allowance?: BriefAllowanceState;
}

export function BriefForm({ brief, hasPaymentMethod = true, allowance }: BriefFormProps) {
  const router = useRouter();
  const isEditing = !!brief;

  const [title, setTitle] = useState(brief?.title || "");
  const [description, setDescription] = useState(brief?.description || "");
  const [objective, setObjective] = useState(brief?.objective || "");
  const [audience, setAudience] = useState(brief?.audience || "");
  const [insight, setInsight] = useState(brief?.insight || "");
  const [message, setMessage] = useState(brief?.message || "");
  const [tone, setTone] = useState(brief?.tone || "");
  const [deliverables, setDeliverables] = useState(brief?.deliverables || "");
  const [mandatories, setMandatories] = useState(brief?.mandatories || "");
  const [category, setCategory] = useState<BriefCategory>(brief?.category || "entertaining");
  const [durationClass, setDurationClass] = useState<BriefDurationClass>(brief?.duration_class || "short");
  const [priceDkk, setPriceDkk] = useState(brief?.price_dkk?.toString() || "");
  const [deadline, setDeadline] = useState(brief?.deadline || "");
  const [location, setLocation] = useState(brief?.location || "");
  const [claimLimit, setClaimLimit] = useState(brief?.claim_limit?.toString() || "1");
  const [referenceUrls, setReferenceUrls] = useState<string[]>(
    brief?.reference_urls?.length ? brief.reference_urls : [""]
  );
  // usage_rights input removed from the form; preserved on the row
  // for any older briefs that were saved with it, so we keep the
  // value around and pass it through unchanged on update.
  const usageRights = brief?.usage_rights || "";
  const [isAdIntended, setIsAdIntended] = useState(brief?.is_ad_intended ?? false);
  const [targetSkills, setTargetSkills] = useState<string[]>(
    brief?.target_skills ?? []
  );
  const [targetLanguages, setTargetLanguages] = useState<string[]>(
    brief?.target_languages ?? []
  );
  const [targetCountries, setTargetCountries] = useState<string[]>(
    brief?.target_countries ?? []
  );

  // Deliverable specs as structured entries
  const [specEntries, setSpecEntries] = useState<SpecEntry[]>(() => {
    const existing = specsToEntries(brief?.deliverable_specs as Record<string, string> | null);
    return existing.length > 0 ? existing : specsToEntries(durationTemplates[brief?.duration_class || "short"].fields);
  });

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Mint a fresh attempt id on each form mount. Stable across
  // submits within this mount (so a retry after a network blip
  // dedupes against the original Stripe charge via the idempotency
  // key in createBriefWithEscrow), regenerated on remount (so a
  // user who deliberately wants to publish the same brief twice can
  // still do so by navigating back to the form).
  const clientAttemptId = useMemo(() => crypto.randomUUID(), []);

  // Tracks which submit action is currently in flight so each button
  // only shows its own loading label. Both buttons stay disabled
  // while any mode is active to prevent double-submits.
  const [submitMode, setSubmitMode] = useState<
    "draft" | "publish" | "save_published" | null
  >(null);
  const saving = submitMode !== null;

  // Toast a brief-publishing error. Plan-limit errors get an
  // "Upgrade" action that jumps to /admin/billing; everything else
  // is a plain error toast.
  function toastSubmitError(message: string) {
    const isPlanLimit = message.toLowerCase().includes("plan allows");
    toast.error(isEditing ? "Couldn't save brief" : "Couldn't publish brief", {
      description: message,
      ...(isPlanLimit && {
        action: {
          label: "Upgrade",
          onClick: () => router.push("/admin/billing"),
        },
      }),
    });
  }

  function toggleMarkdown(type: "bold" | "italic") {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.slice(start, end);
    const wrapper = type === "bold" ? "**" : "*";

    // Check if selection is already wrapped
    const beforeStart = start - wrapper.length;
    const afterEnd = end + wrapper.length;
    const alreadyWrapped =
      beforeStart >= 0 &&
      afterEnd <= description.length &&
      description.slice(beforeStart, start) === wrapper &&
      description.slice(end, afterEnd) === wrapper;

    let newText: string;
    let newCursorStart: number;
    let newCursorEnd: number;

    if (alreadyWrapped) {
      // Unwrap
      newText =
        description.slice(0, beforeStart) +
        selected +
        description.slice(afterEnd);
      newCursorStart = beforeStart;
      newCursorEnd = beforeStart + selected.length;
    } else if (selected) {
      // Wrap selection
      newText =
        description.slice(0, start) +
        wrapper + selected + wrapper +
        description.slice(end);
      newCursorStart = start + wrapper.length;
      newCursorEnd = end + wrapper.length;
    } else {
      // No selection — insert placeholder
      const placeholder = type === "bold" ? "bold text" : "italic text";
      newText =
        description.slice(0, start) +
        wrapper + placeholder + wrapper +
        description.slice(end);
      newCursorStart = start + wrapper.length;
      newCursorEnd = start + wrapper.length + placeholder.length;
    }

    setDescription(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    });
  }

  function handleDescriptionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      toggleMarkdown("bold");
    } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      toggleMarkdown("italic");
    }
  }

  function applyTemplate(duration: BriefDurationClass) {
    const template = durationTemplates[duration];
    const templateEntries = specsToEntries(template.fields);

    // Merge: keep existing custom fields, update/add template fields
    const existingCustom = specEntries.filter(
      (e) => !(e.key in durationTemplates[durationClass].fields) && !(e.key in template.fields)
    );
    setSpecEntries([...templateEntries, ...existingCustom]);
  }

  // When duration class changes, offer to apply template
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [pendingDurationClass, setPendingDurationClass] = useState<BriefDurationClass | null>(null);

  function handleDurationChange(newDurationClass: BriefDurationClass) {
    if (newDurationClass !== durationClass && specEntries.length > 0) {
      setPendingDurationClass(newDurationClass);
      setShowTemplatePrompt(true);
    } else {
      setDurationClass(newDurationClass);
      applyTemplate(newDurationClass);
    }
  }

  function confirmTemplateApply(apply: boolean) {
    if (pendingDurationClass) {
      setDurationClass(pendingDurationClass);
      if (apply) applyTemplate(pendingDurationClass);
      setPendingDurationClass(null);
    }
    setShowTemplatePrompt(false);
  }

  function buildBaseInput() {
    return {
      title: title.trim(),
      description,
      objective: objective.trim() || null,
      audience: audience.trim() || null,
      insight: insight.trim() || null,
      message: message.trim() || null,
      tone: tone.trim() || null,
      deliverables: deliverables.trim() || null,
      mandatories: mandatories.trim() || null,
      category,
      duration_class: durationClass,
      price_dkk: parseInt(priceDkk) || 0,
      deadline: deadline || null,
      location: location || null,
      claim_limit: parseInt(claimLimit) || 1,
      reference_urls: referenceUrls.map((u) => u.trim()).filter(Boolean),
      usage_rights: usageRights || null,
      deliverable_specs: entriesToSpecs(specEntries),
      is_ad_intended: isAdIntended,
      target_skills: targetSkills,
      target_languages: targetLanguages,
      target_countries: targetCountries,
    };
  }

  function validateTitleAndEscrow(): boolean {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastSubmitError("Title is required.");
      return false;
    }
    if (trimmedTitle.length > MAX_BRIEF_TITLE_LEN) {
      toastSubmitError(
        `Title must be ${MAX_BRIEF_TITLE_LEN} characters or fewer.`
      );
      return false;
    }
    return true;
  }

  async function handleSaveDraft(e: React.MouseEvent) {
    e.preventDefault();
    if (!validateTitleAndEscrow()) return;
    // Drafts can ignore the escrow floor since no charge will fire;
    // the floor only matters on publish.
    setSubmitMode("draft");

    if (isEditing && brief && brief.status === "draft") {
      const result = await updateBriefDraft(brief.id, buildBaseInput());
      if (!result.ok) {
        toastSubmitError(result.error);
        setSubmitMode(null);
        return;
      }
      toast.success("Draft saved");
      setSubmitMode(null);
      router.push("/admin/briefs");
      router.refresh();
      return;
    }

    // New brief saved as draft.
    const result = await saveBriefDraft(buildBaseInput());
    if (!result.ok) {
      toastSubmitError(result.error);
      setSubmitMode(null);
      return;
    }
    toast.success("Draft saved");
    setSubmitMode(null);
    router.push("/admin/briefs");
    router.refresh();
  }

  async function handlePublish(e: React.MouseEvent | React.FormEvent) {
    e.preventDefault();
    if (!validateTitleAndEscrow()) return;
    if (belowMinimumEscrow) {
      toastSubmitError(
        `Total escrow must be at least ${MIN_TOTAL_ESCROW_DKK} DKK. Increase the price or the slot count.`
      );
      return;
    }
    setSubmitMode("publish");

    // Publishing an existing draft: the brief row exists, just settle
    // the charge and flip status to 'open'. Server action redirects
    // on success.
    if (isEditing && brief && brief.status === "draft") {
      // Save any unsaved edits first so the publish reflects the
      // latest form state (price, slots, title — all matter for the
      // charge math).
      const draftSave = await updateBriefDraft(brief.id, buildBaseInput());
      if (!draftSave.ok) {
        toastSubmitError(draftSave.error);
        setSubmitMode(null);
        return;
      }
      const result = await publishBriefFromDraft(brief.id, clientAttemptId);
      const limitError = planLimitErrorMessage({ message: result.error });
      toastSubmitError(limitError ?? result.error);
      setSubmitMode(null);
      return;
    }

    // New brief published directly. Server action redirects on
    // success, so any returned value is by definition a failure.
    const result = await createBriefWithEscrow({
      ...buildBaseInput(),
      client_attempt_id: clientAttemptId,
    });
    const limitError = planLimitErrorMessage({ message: result.error });
    toastSubmitError(limitError ?? result.error);
    setSubmitMode(null);
  }

  async function handleSavePublished(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTitleAndEscrow()) return;

    setSubmitMode("save_published");
    // Edit path for already-published briefs stays a direct
    // client-side update — no escrow re-charge (escrow is locked at
    // publish time per 1.1a). Refunds on price/limit changes are
    // out of scope.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toastSubmitError("You must be logged in");
      setSubmitMode(null);
      return;
    }

    const trimmedTitle = title.trim();
    const updatePayload: Record<string, unknown> = {
      title: trimmedTitle,
      description,
      objective: objective.trim() || null,
      audience: audience.trim() || null,
      insight: insight.trim() || null,
      message: message.trim() || null,
      tone: tone.trim() || null,
      deliverables: deliverables.trim() || null,
      mandatories: mandatories.trim() || null,
      category,
      duration_class: durationClass,
      deadline: deadline || null,
      location: location || null,
      reference_urls: referenceUrls.map((u) => u.trim()).filter(Boolean),
      usage_rights: usageRights || null,
      deliverable_specs: entriesToSpecs(specEntries),
      is_ad_intended: isAdIntended,
    };
    if (!escrowLocked) {
      updatePayload.price_dkk = parseInt(priceDkk) || 0;
      updatePayload.claim_limit = parseInt(claimLimit) || 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase.from("briefs") as any)
      .update(updatePayload)
      .eq("id", brief!.id);

    if (result.error) {
      const limitError = planLimitErrorMessage(result.error);
      const rawMessage = (result.error as { message?: string }).message ?? "";
      const isEscrowLockError =
        rawMessage.includes("escrow column") ||
        rawMessage.includes("funded_status");
      const escrowError = isEscrowLockError
        ? "Price, slot count, and escrow fields are locked once a brief is funded. Archive and republish to change them."
        : null;
      toastSubmitError(limitError ?? escrowError ?? "Failed to save brief");
      setSubmitMode(null);
      return;
    }

    toast.success(
      "Brief saved",
      trimmedTitle ? { description: trimmedTitle } : undefined
    );
    setSubmitMode(null);
    router.push("/admin/briefs");
    router.refresh();
  }

  // Form-level submit dispatches based on the brief's lifecycle
  // state. New briefs and drafts default to Publish on Enter; this
  // matches the primary CTA below.
  async function handleSubmit(e: React.FormEvent) {
    if (isEditing && brief && brief.status !== "draft") {
      await handleSavePublished(e);
      return;
    }
    await handlePublish(e);
  }

  const priceNum = parseInt(priceDkk) || 0;
  const slotsNum = parseInt(claimLimit) || 1;
  const escrowTotal = priceNum * slotsNum;
  const isPaidCreate = !isEditing && priceNum > 0;
  const blockedOnPaymentMethod = isPaidCreate && !hasPaymentMethod;
  // Stripe's DKK minimum is 2.50 kr (250 øre); since DKK is stored
  // in whole units the practical floor is 3 DKK total. Mirrored on
  // the server in actions.ts; the form-level guard here keeps the
  // user from round-tripping Stripe just to learn the floor.
  const belowMinimumEscrow = isPaidCreate && escrowTotal < MIN_TOTAL_ESCROW_DKK;

  // Once a brief has been funded, the escrow PaymentIntent locks in
  // `price_dkk × claim_limit` at publish time. Allowing edits to those
  // two fields after funding would let an admin silently inflate the
  // price (so payClaim transfers more than escrow holds) or shrink the
  // slot count (stranding funds in escrow). Lock the inputs.
  // Adjustments to a funded brief require archive + republish.
  const escrowLocked =
    isEditing && (brief?.funded_status ?? "unfunded") !== "unfunded";

  // Pricing v2: derive publish-charge labels and hints from the
  // allowance state. When `allowance` isn't passed (legacy callers
  // like the published-brief edit page), fall back to the old
  // escrow-only label so nothing breaks.
  const showPublishedEditOnly = isEditing && brief?.status !== "draft";

  const publishDecision = allowance ? decidePublishCharge(allowance) : null;
  const overageDkk =
    publishDecision?.kind === "overage" ? publishDecision.overageDkk : 0;
  const publishBlocked = publishDecision?.kind === "blocked";
  const totalChargeDkk = escrowTotal + overageDkk;

  let publishLabel: string;
  if (submitMode === "publish") {
    publishLabel = totalChargeDkk > 0 ? "Charging…" : "Publishing…";
  } else if (publishBlocked) {
    publishLabel = "Upgrade to publish";
  } else if (totalChargeDkk > 0) {
    publishLabel = `Publish & charge ${formatDkk(totalChargeDkk)}`;
  } else {
    publishLabel = "Publish";
  }

  let publishHint: string | null = null;
  if (publishDecision?.kind === "overage") {
    publishHint = `Over the monthly allowance: ${formatDkk(overageDkk)} overage on top of escrow.`;
  } else if (publishDecision?.kind === "allowance" && allowance?.allowance != null) {
    const used = (allowance.publishedThisPeriod ?? 0) + 1;
    publishHint = `Counts as ${used} of ${allowance.allowance} included briefs this month.`;
  } else if (publishDecision?.kind === "blocked") {
    publishHint = publishDecision.reason;
  }

  const inputClass = "w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* ============================================================
          Creative brief
          ============================================================ */}
      <section className="space-y-6">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Creative brief</h2>
          <p className="text-xs text-muted mt-1">
            The thinking that anchors the work. Tell creators why this exists, who it talks to, and what it must say.
          </p>
        </div>

      {/* Project (formerly Title) */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2">
          Project <span className="text-error">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={MAX_BRIEF_TITLE_LEN}
          className={inputClass}
          placeholder="Boulders Spring Send Season"
          aria-describedby="title-counter"
        />
        <p className="text-muted text-xs mt-1">
          Recommended: a short working name your team will recognise at a glance.
        </p>
        <p
          id="title-counter"
          className={`mt-1.5 text-xs text-right ${
            title.length >= MAX_BRIEF_TITLE_LEN
              ? "text-warning"
              : title.length >= MAX_BRIEF_TITLE_LEN - 10
                ? "text-muted"
                : "text-muted/60"
          }`}
        >
          {title.length}/{MAX_BRIEF_TITLE_LEN}
        </p>
      </div>

      {/* Objective */}
      <div>
        <label htmlFor="objective" className="block text-sm font-medium mb-2">
          Objective
        </label>
        <textarea
          id="objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Drive sign-ups for our new intro climbing course at Boulders Valby. Goal: 80 new memberships by end of June."
        />
        <p className="text-muted text-xs mt-1">
          Recommended: one or two sentences on the business outcome this campaign should deliver.
        </p>
      </div>

      {/* Audience */}
      <div>
        <label htmlFor="audience" className="block text-sm font-medium mb-2">
          Audience
        </label>
        <textarea
          id="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Urban climbers and climb-curious office workers aged 25 to 40 in Copenhagen. Active, social, looking for a third place after work."
        />
        <p className="text-muted text-xs mt-1">
          Recommended: who the content talks to, not who creates it. Demographics, mindset, where they spend time.
        </p>
      </div>

      {/* Insight */}
      <div>
        <label htmlFor="insight" className="block text-sm font-medium mb-2">
          Insight
        </label>
        <textarea
          id="insight"
          value={insight}
          onChange={(e) => setInsight(e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Most newcomers think bouldering is intimidating and elite. In reality, the gym is the most welcoming room in the city on a Tuesday night."
        />
        <p className="text-muted text-xs mt-1">
          Recommended: the human truth about your audience that the creative should lean into.
        </p>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2">
          Message
        </label>
        <input
          id="message"
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          className={inputClass}
          placeholder="Climbing is for everyone, and Tuesday is the easiest night to start."
          aria-describedby="message-counter"
        />
        <div className="flex items-start justify-between gap-3 mt-1">
          <p className="text-muted text-xs">
            Recommended: one sentence the audience should walk away believing. Around 140 characters.
          </p>
          <p
            id="message-counter"
            className={`shrink-0 text-xs ${
              message.length > 140 ? "text-warning" : "text-muted/60"
            }`}
          >
            {message.length}/140
          </p>
        </div>
      </div>

      {/* Tone */}
      <div>
        <label htmlFor="tone" className="block text-sm font-medium mb-2">
          Tone
        </label>
        <textarea
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder="Energetic, warm, slightly playful. Confident without being macho. Think morning espresso, not protein shake."
        />
        <p className="text-muted text-xs mt-1">
          Recommended: a few adjectives plus a reference touchstone. Voice, vibe, feel.
        </p>
      </div>

      {/* Deliverables */}
      <div>
        <label htmlFor="deliverables" className="block text-sm font-medium mb-2">
          Deliverables
        </label>
        <textarea
          id="deliverables"
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          rows={5}
          className={`${inputClass} resize-y`}
          placeholder={"One 30 to 45 second vertical reel for Instagram and TikTok. Hook in the first 2 seconds. Captions burned in.\nOne supporting 9:16 still for the in-feed ad."}
        />
        <p className="text-muted text-xs mt-1">
          Recommended: what to produce, in plain prose. Format, length, aspect, captions.
        </p>
      </div>

      {/* Mandatories */}
      <div>
        <label htmlFor="mandatories" className="block text-sm font-medium mb-2">
          Mandatories
        </label>
        <textarea
          id="mandatories"
          value={mandatories}
          onChange={(e) => setMandatories(e.target.value)}
          rows={5}
          className={`${inputClass} resize-y`}
          placeholder={"Boulders logo end-frame, 1 second.\nCTA: \"Book your intro at boulders.dk\".\nUse only chalk-friendly safe holds; no climbing without spotters in frame.\nUsage rights: paid social, 12 months, EU."}
        />
        <p className="text-muted text-xs mt-1">
          Recommended: non-negotiables. Logo, CTA, legal, usage rights, anything the creator must include.
        </p>
      </div>

      {/* Additional notes (formerly Description) */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Additional notes
        </label>
        <div className="border border-border rounded-lg overflow-hidden focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-colors">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-raised border-b border-border">
            <button
              type="button"
              onClick={() => toggleMarkdown("bold")}
              className="px-2 py-1 text-sm font-bold text-muted hover:text-foreground hover:bg-surface-hover rounded transition-colors"
              title="Bold (Cmd+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => toggleMarkdown("italic")}
              className="px-2 py-1 text-sm italic text-muted hover:text-foreground hover:bg-surface-hover rounded transition-colors"
              title="Italic (Cmd+I)"
            >
              I
            </button>
          </div>
          <textarea
            ref={descriptionRef}
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleDescriptionKeyDown}
            rows={5}
            className="w-full px-4 py-3 bg-surface resize-y border-0 focus:ring-0 focus:outline-none"
            placeholder={"Anything else useful. Logistics quirks, scheduling notes, links to mood boards.\n\n## Access\n- Ask at front desk for Mads, route-setter on Tuesdays"}
          />
        </div>
        <p className="text-muted text-sm mt-1">
          Supports markdown: **bold**, *italic*, - lists, ## headings
        </p>
        {description.trim() && (
          <div className="mt-3 px-4 py-3 bg-surface-raised border border-border rounded-lg">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Preview</p>
            <div className="prose-brief text-sm">
              <ReactMarkdown
                components={{
                  a: ({ children, href, ...props }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                  ),
                }}
              >
                {description}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      </section>

      {/* ============================================================
          Logistics
          ============================================================ */}
      <section className="space-y-6 pt-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Logistics</h2>
          <p className="text-xs text-muted mt-1">
            How the brief runs. Category, budget, deadline, who can claim it.
          </p>
        </div>

      {/* Category & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            Category <span className="text-error">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BriefCategory)}
            className={inputClass}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="durationClass" className="block text-sm font-medium mb-2">
            Duration Class <span className="text-error">*</span>
          </label>
          <select
            id="durationClass"
            value={durationClass}
            onChange={(e) => handleDurationChange(e.target.value as BriefDurationClass)}
            className={inputClass}
          >
            {durationClasses.map((duration) => (
              <option key={duration.value} value={duration.value}>
                {duration.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template prompt when duration changes */}
      {showTemplatePrompt && pendingDurationClass && (
        <div className="bg-accent-muted border border-accent/20 rounded-lg p-4">
          <p className="text-sm mb-3">
            Apply <span className="font-semibold text-accent">{durationClasses.find((d) => d.value === pendingDurationClass)?.label}</span> template to deliverable specs?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => confirmTemplateApply(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
            >
              Apply template
            </button>
            <button
              type="button"
              onClick={() => confirmTemplateApply(false)}
              className="px-4 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
            >
              Keep current specs
            </button>
          </div>
        </div>
      )}

      {/* Price & Claim Limit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-2">
            Price (DKK) <span className="text-error">*</span>
          </label>
          <input
            id="price"
            type="number"
            value={priceDkk}
            onChange={(e) => setPriceDkk(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            required
            min="0"
            disabled={escrowLocked}
            className={`${inputClass} font-mono ${
              escrowLocked ? "opacity-60 cursor-not-allowed" : ""
            }`}
            placeholder="2500"
          />
          {escrowLocked && (
            <p className="text-muted text-xs mt-1">
              Locked — escrow set when published. Archive & republish to
              change.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="claimLimit" className="block text-sm font-medium mb-2">
            Claim Limit
          </label>
          <input
            id="claimLimit"
            type="number"
            value={claimLimit}
            onChange={(e) => setClaimLimit(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            min="1"
            disabled={escrowLocked}
            className={`${inputClass} font-mono ${
              escrowLocked ? "opacity-60 cursor-not-allowed" : ""
            }`}
            placeholder="1"
          />
          <p className="text-muted text-sm mt-1">
            {escrowLocked
              ? "Locked — escrow covers the original slot count."
              : "How many creators can claim this"}
          </p>
        </div>
      </div>

      {/* Deadline & Gym */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="deadline" className="block text-sm font-medium mb-2">
            Deadline
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-2">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="e.g. Downtown Studio"
          />
        </div>
      </div>

      {/* Reference URLs */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Reference URLs
        </label>
        <div className="space-y-2">
          {referenceUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  const updated = [...referenceUrls];
                  updated[i] = e.target.value;
                  setReferenceUrls(updated);
                }}
                className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm font-mono focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                placeholder="https://instagram.com/reel/..."
              />
              {referenceUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReferenceUrls(referenceUrls.filter((_, j) => j !== i))}
                  className="p-2 text-muted hover:text-error transition-colors shrink-0"
                  aria-label="Remove URL"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReferenceUrls([...referenceUrls, ""])}
          className="mt-2 px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent-muted transition-colors"
        >
          + Add URL
        </button>
      </div>

      {/* Targeting criteria. Soft-match only, these don't hard-filter
          creators on /briefs, they just rank matching briefs higher
          on each creator's feed. Empty in any dimension means "no
          preference" for that dimension. */}
      <TargetingSection
        skills={targetSkills}
        onSkills={setTargetSkills}
        languages={targetLanguages}
        onLanguages={setTargetLanguages}
        countries={targetCountries}
        onCountries={setTargetCountries}
        inputClass={inputClass}
      />

      {/* Ad Intended */}
      <div className="flex items-start gap-3 p-4 bg-surface border border-border rounded-lg">
        <input
          id="isAdIntended"
          type="checkbox"
          checked={isAdIntended}
          onChange={(e) => setIsAdIntended(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-0"
        />
        <div>
          <label htmlFor="isAdIntended" className="block text-sm font-medium cursor-pointer">
            Intended for Ads
          </label>
          <p className="text-muted text-sm mt-0.5">
            This content will likely be used as paid advertising. Creators will see a badge on this brief.
          </p>
        </div>
      </div>
      </section>

      {/* Upfront cost panel, only on the create flow with a paid
          brief. Editing keeps the original escrow contract; free
          briefs (price 0) skip the charge entirely. */}
      {isPaidCreate && (
        <div
          className={`border rounded-lg p-4 ${
            blockedOnPaymentMethod || belowMinimumEscrow
              ? "bg-error/5 border-error/30"
              : "bg-accent/5 border-accent/30"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted mb-1">
                Upfront escrow charge
              </p>
              <p className="text-lg font-semibold">
                {formatDkk(priceNum)}{" "}
                <span className="text-muted font-normal">×</span>{" "}
                {slotsNum} {slotsNum === 1 ? "slot" : "slots"}{" "}
                <span className="text-muted font-normal">=</span>{" "}
                <span
                  className={belowMinimumEscrow ? "text-error" : "text-accent"}
                >
                  {formatDkk(escrowTotal)}
                </span>
              </p>
              <p className="text-xs text-muted mt-1">
                Charged to your saved card when you publish. Held in
                escrow and released to creators as you approve their
                submissions.
              </p>
            </div>
          </div>
          {belowMinimumEscrow && (
            <div className="mt-3 pt-3 border-t border-error/20">
              <p className="text-sm text-error">
                Total must be at least {formatDkk(MIN_TOTAL_ESCROW_DKK)} —
                Stripe rejects smaller charges in DKK. Bump the price or
                add more slots.
              </p>
            </div>
          )}
          {blockedOnPaymentMethod && (
            <div className="mt-3 pt-3 border-t border-error/20">
              <p className="text-sm text-error">
                No payment method on file.{" "}
                <Link
                  href="/admin/billing"
                  className="underline hover:no-underline font-medium"
                >
                  Add one on /admin/billing →
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Allowance hint + actions */}
      {publishHint && (
        <p className="pt-2 text-xs text-muted">{publishHint}</p>
      )}
      <div className="flex items-center gap-4 pt-4">
        {showPublishedEditOnly ? (
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
          >
            {submitMode === "save_published" ? "Saving…" : "Save Changes"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handlePublish}
              disabled={
                saving || blockedOnPaymentMethod || belowMinimumEscrow ||
                publishBlocked
              }
              className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
            >
              {publishLabel}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-3 border border-border hover:bg-surface-hover text-foreground font-medium rounded-lg transition-colors"
            >
              {submitMode === "draft" ? "Saving…" : "Save as draft"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-border hover:bg-surface-hover text-foreground font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TargetingSection({
  skills,
  onSkills,
  languages,
  onLanguages,
  countries,
  onCountries,
  inputClass,
}: {
  skills: string[];
  onSkills: (next: string[]) => void;
  languages: string[];
  onLanguages: (next: string[]) => void;
  countries: string[];
  onCountries: (next: string[]) => void;
  inputClass: string;
}) {
  function toggleSkill(slug: string) {
    if (skills.includes(slug)) {
      onSkills(skills.filter((s) => s !== slug));
    } else if (skills.length < SKILLS_MAX) {
      onSkills([...skills, slug]);
    }
  }
  function toggleCountry(code: string) {
    if (countries.includes(code)) {
      onCountries(countries.filter((c) => c !== code));
    } else if (countries.length < COUNTRIES_MAX) {
      onCountries([...countries, code]);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-surface space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Looking for</h3>
        <p className="text-xs text-muted">
          Optional. Leave blank for any creator. Briefs with criteria
          surface higher on matching creators&apos; feeds, but every
          creator can still see and claim them.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Skills</label>
          <span className="text-xs text-muted font-mono">
            {skills.length}/{SKILLS_MAX}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const isSelected = skills.includes(s.slug);
            const atCap = skills.length >= SKILLS_MAX;
            const isDisabled = !isSelected && atCap;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSkill(s.slug)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "px-3 py-1.5 rounded-full text-sm font-medium bg-brand-muted text-brand border border-brand/40"
                    : "px-3 py-1.5 rounded-full text-sm font-medium border border-border text-muted hover:border-border-strong hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                }
              >
                {skillLabel(s.slug)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Languages</label>
        <LanguagePicker
          selected={languages}
          onChange={onLanguages}
          inputClassName={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Countries</label>
          {countries.length > 0 && (
            <span className="text-xs text-muted font-mono">
              {countries.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => {
            const isSelected = countries.includes(c.code);
            const atCap = countries.length >= COUNTRIES_MAX;
            const isDisabled = !isSelected && atCap;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleCountry(c.code)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "px-3 py-1.5 rounded-full text-sm font-medium bg-brand-muted text-brand border border-brand/40 inline-flex items-center gap-1.5"
                    : "px-3 py-1.5 rounded-full text-sm font-medium border border-border text-muted hover:border-border-strong hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
                }
              >
                <span aria-hidden>{c.flag}</span>
                <span>{countryLabel(c.code) ?? c.code}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
