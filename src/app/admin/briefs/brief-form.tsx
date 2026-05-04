"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOrgId } from "@/lib/org-context";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  planLimitErrorMessage,
  MIN_TOTAL_ESCROW_DKK,
  MAX_BRIEF_TITLE_LEN,
  formatDkk,
} from "@/lib/pricing";
import { createBriefWithEscrow } from "./actions";
import type { Brief, BriefCategory, BriefDurationClass } from "@/types/database";

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

// Predefined spec fields available for all formats
const commonFields = [
  { key: "captions", label: "Captions", placeholder: "Required, centered" },
  { key: "music", label: "Music / Audio", placeholder: "Trending audio, original, etc." },
  { key: "style", label: "Style", placeholder: "Cinematic, vlog, raw, etc." },
];

// Duration-specific templates with pre-filled defaults
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

// All known spec field labels (for display)
const specFieldLabels: Record<string, string> = {
  duration: "Duration",
  aspect_ratio: "Aspect Ratio",
  captions: "Captions",
  music: "Music / Audio",
  style: "Style",
  resolution: "Resolution",
  file_format: "File Format",
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
}

export function BriefForm({ brief, hasPaymentMethod = true }: BriefFormProps) {
  const router = useRouter();
  const orgId = useOrgId();
  const isEditing = !!brief;

  const [title, setTitle] = useState(brief?.title || "");
  const [description, setDescription] = useState(brief?.description || "");
  const [category, setCategory] = useState<BriefCategory>(brief?.category || "entertaining");
  const [durationClass, setDurationClass] = useState<BriefDurationClass>(brief?.duration_class || "short");
  const [priceDkk, setPriceDkk] = useState(brief?.price_dkk?.toString() || "");
  const [deadline, setDeadline] = useState(brief?.deadline || "");
  const [location, setLocation] = useState(brief?.location || "");
  const [claimLimit, setClaimLimit] = useState(brief?.claim_limit?.toString() || "1");
  const [referenceUrls, setReferenceUrls] = useState<string[]>(
    brief?.reference_urls?.length ? brief.reference_urls : [""]
  );
  const [usageRights, setUsageRights] = useState(brief?.usage_rights || "");
  const [isAdIntended, setIsAdIntended] = useState(brief?.is_ad_intended ?? false);

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

  const [saving, setSaving] = useState(false);

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

  function updateEntry(index: number, field: "key" | "value", val: string) {
    setSpecEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: val } : e)));
  }

  function removeEntry(index: number) {
    setSpecEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function addEntry() {
    setSpecEntries((prev) => [...prev, { key: "", value: "" }]);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Trim once at submit time so leading/trailing whitespace can't
    // sneak into the row (and break list sorting / matching) while
    // still letting the user type spaces inside the title.
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastSubmitError("Title is required.");
      return;
    }
    if (trimmedTitle.length > MAX_BRIEF_TITLE_LEN) {
      toastSubmitError(
        `Title must be ${MAX_BRIEF_TITLE_LEN} characters or fewer.`
      );
      return;
    }

    // Belt-and-suspenders: the submit button is disabled below the
    // minimum, but a tampered `disabled` attribute or a keyboard
    // submit can still get here. Re-check before charging the round
    // trip cost to the server action and Stripe.
    if (belowMinimumEscrow) {
      toastSubmitError(
        `Total escrow must be at least ${MIN_TOTAL_ESCROW_DKK} DKK. Increase the price or the slot count.`
      );
      return;
    }

    setSaving(true);

    if (isEditing) {
      // Edit path stays a direct client-side update — no escrow
      // re-charge on edits (escrow is locked at publish time per
      // 1.1a). Refunds on price/limit changes are out of scope.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toastSubmitError("You must be logged in");
        setSaving(false);
        return;
      }

      // Build the update payload. Skip price + claim_limit on funded
      // briefs even if the disabled inputs were tampered with — the
      // disabled attribute is a UX hint, not a security boundary.
      const updatePayload: Record<string, unknown> = {
        title: trimmedTitle,
        description,
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
        .eq("id", brief.id);

      if (result.error) {
        const limitError = planLimitErrorMessage(result.error);
        // Surface the escrow-immutability trigger from migration 0038
        // as a friendly message instead of a raw Postgres exception.
        // The trigger is the security boundary; the disabled inputs
        // above are only a UX hint, so a tampered payload can still
        // trip the trigger.
        const rawMessage = (result.error as { message?: string }).message ?? "";
        const isEscrowLockError =
          rawMessage.includes("escrow column") ||
          rawMessage.includes("funded_status");
        const escrowError = isEscrowLockError
          ? "Price, slot count, and escrow fields are locked once a brief is funded. Archive and republish to change them."
          : null;
        toastSubmitError(limitError ?? escrowError ?? "Failed to save brief");
        setSaving(false);
        return;
      }

      toast.success(
        "Brief saved",
        trimmedTitle ? { description: trimmedTitle } : undefined
      );
      router.push("/admin/briefs");
      router.refresh();
      return;
    }

    // Create path — server action runs the escrow PaymentIntent +
    // insert, then redirects to /admin/briefs on success. The
    // redirect throws inside the action, so any value we receive
    // back here is by definition a failure result.
    const result = await createBriefWithEscrow({
      title: trimmedTitle,
      description,
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
      client_attempt_id: clientAttemptId,
    });

    const limitError = planLimitErrorMessage({ message: result.error });
    toastSubmitError(limitError ?? result.error);
    setSaving(false);
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

  const inputClass = "w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2">
          Title <span className="text-error">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={MAX_BRIEF_TITLE_LEN}
          className={inputClass}
          placeholder="Summer Send Session Reel"
          aria-describedby="title-counter"
        />
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

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description <span className="text-error">*</span>
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
            required
            rows={6}
            className="w-full px-4 py-3 bg-surface resize-y border-0 focus:ring-0 focus:outline-none"
            placeholder={"Describe the brief, what you're looking for, and any requirements...\n\n## Krav\n- Ekstern mikrofon\n- Adgang til rutebygger-teamet"}
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

      {/* Deliverable Specs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">Deliverable Specs</label>
          <button
            type="button"
            onClick={() => applyTemplate(durationClass)}
            className="text-xs text-accent hover:underline"
          >
            Reset to {durationClasses.find((d) => d.value === durationClass)?.label} template
          </button>
        </div>

        <div className="space-y-2">
          {specEntries.map((entry, i) => {
            const isKnown = entry.key in specFieldLabels;
            return (
              <div key={i} className="flex items-center gap-2">
                {isKnown ? (
                  <span className="w-40 shrink-0 px-3 py-2.5 bg-surface-raised border border-border rounded-lg text-sm text-muted">
                    {specFieldLabels[entry.key]}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={entry.key}
                    onChange={(e) => updateEntry(i, "key", e.target.value)}
                    placeholder="Field name"
                    className="w-40 shrink-0 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                  />
                )}
                <input
                  type="text"
                  value={entry.value}
                  onChange={(e) => updateEntry(i, "value", e.target.value)}
                  placeholder={isKnown ? (commonFields.find((f) => f.key === entry.key)?.placeholder || "") : "Value"}
                  className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="p-2 text-muted hover:text-error transition-colors shrink-0"
                  aria-label="Remove field"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Add field buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Quick-add known fields that aren't already present */}
          {[...Object.entries(specFieldLabels)].filter(
            ([key]) => !specEntries.some((e) => e.key === key)
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSpecEntries((prev) => [...prev, { key, value: "" }])}
              className="px-2.5 py-1 text-xs font-medium text-muted border border-border rounded-md hover:border-accent/40 hover:text-accent transition-colors"
            >
              + {label}
            </button>
          ))}
          <button
            type="button"
            onClick={addEntry}
            className="px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent-muted transition-colors"
          >
            + Custom field
          </button>
        </div>
      </div>

      {/* Usage Rights */}
      <div>
        <label htmlFor="usageRights" className="block text-sm font-medium mb-2">
          Usage Rights
        </label>
        <textarea
          id="usageRights"
          value={usageRights}
          onChange={(e) => setUsageRights(e.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
          placeholder="e.g. Perpetual usage rights across all brand social channels"
        />
      </div>

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

      {/* Upfront cost panel — only on the create flow with a paid
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

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={saving || blockedOnPaymentMethod || belowMinimumEscrow}
          className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
        >
          {saving
            ? isPaidCreate
              ? "Charging…"
              : "Saving..."
            : isEditing
              ? "Save Changes"
              : isPaidCreate
                ? `Publish & charge ${formatDkk(escrowTotal)}`
                : "Create Brief"}
        </button>
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
