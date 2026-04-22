"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Brief, BriefCategory, BriefFormat } from "@/types/database";

const categories: { value: BriefCategory; label: string }[] = [
  { value: "entertaining", label: "Entertaining" },
  { value: "ad", label: "Ad" },
  { value: "guide", label: "Guide" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
];

const formats: { value: BriefFormat; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "long_form", label: "Long Form" },
  { value: "photo", label: "Photo" },
];

interface BriefFormProps {
  brief?: Brief;
}

export function BriefForm({ brief }: BriefFormProps) {
  const router = useRouter();
  const isEditing = !!brief;

  const [title, setTitle] = useState(brief?.title || "");
  const [description, setDescription] = useState(brief?.description || "");
  const [category, setCategory] = useState<BriefCategory>(brief?.category || "entertaining");
  const [format, setFormat] = useState<BriefFormat>(brief?.format || "reel");
  const [priceDkk, setPriceDkk] = useState(brief?.price_dkk?.toString() || "");
  const [deadline, setDeadline] = useState(brief?.deadline || "");
  const [gym, setGym] = useState(brief?.gym || "");
  const [claimLimit, setClaimLimit] = useState(brief?.claim_limit?.toString() || "1");
  const [referenceUrls, setReferenceUrls] = useState(brief?.reference_urls?.join("\n") || "");
  const [usageRights, setUsageRights] = useState(brief?.usage_rights || "");
  const [specsJson, setSpecsJson] = useState(
    brief?.deliverable_specs ? JSON.stringify(brief.deliverable_specs, null, 2) : ""
  );
  const [isAdIntended, setIsAdIntended] = useState(brief?.is_ad_intended ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in");
      setSaving(false);
      return;
    }

    let deliverableSpecs = {};
    if (specsJson.trim()) {
      try {
        deliverableSpecs = JSON.parse(specsJson);
      } catch {
        setError("Invalid JSON in deliverable specs");
        setSaving(false);
        return;
      }
    }

    const briefData = {
      title,
      description,
      category,
      format,
      price_dkk: parseInt(priceDkk) || 0,
      deadline: deadline || null,
      gym: gym || null,
      claim_limit: parseInt(claimLimit) || 1,
      reference_urls: referenceUrls.split("\n").map((u) => u.trim()).filter(Boolean),
      usage_rights: usageRights || null,
      deliverable_specs: deliverableSpecs,
      is_ad_intended: isAdIntended,
      created_by: user.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result;
    if (isEditing) {
      result = await (supabase.from("briefs") as any)
        .update(briefData)
        .eq("id", brief.id);
    } else {
      result = await (supabase.from("briefs") as any).insert(briefData);
    }

    if (result.error) {
      console.error("Save error:", result.error);
      setError("Failed to save brief");
      setSaving(false);
      return;
    }

    router.push("/admin/briefs");
    router.refresh();
  }

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
          className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          placeholder="Summer Send Session Reel"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description <span className="text-error">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
          placeholder="Describe the brief, what you're looking for, and any requirements..."
        />
      </div>

      {/* Category & Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2">
            Category <span className="text-error">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BriefCategory)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="format" className="block text-sm font-medium mb-2">
            Format <span className="text-error">*</span>
          </label>
          <select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as BriefFormat)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          >
            {formats.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            required
            min="0"
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
            placeholder="2500"
          />
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
            min="1"
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors font-mono"
            placeholder="1"
          />
          <p className="text-muted text-sm mt-1">How many creators can claim this</p>
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
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <div>
          <label htmlFor="gym" className="block text-sm font-medium mb-2">
            Gym
          </label>
          <input
            id="gym"
            type="text"
            value={gym}
            onChange={(e) => setGym(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder="Boulders Sydhavn"
          />
        </div>
      </div>

      {/* Reference URLs */}
      <div>
        <label htmlFor="referenceUrls" className="block text-sm font-medium mb-2">
          Reference URLs
        </label>
        <textarea
          id="referenceUrls"
          value={referenceUrls}
          onChange={(e) => setReferenceUrls(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none font-mono text-sm"
          placeholder="https://instagram.com/reel/example1&#10;https://instagram.com/reel/example2"
        />
        <p className="text-muted text-sm mt-1">One URL per line</p>
      </div>

      {/* Deliverable Specs */}
      <div>
        <label htmlFor="specs" className="block text-sm font-medium mb-2">
          Deliverable Specs (JSON)
        </label>
        <textarea
          id="specs"
          value={specsJson}
          onChange={(e) => setSpecsJson(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none font-mono text-sm"
          placeholder='{"duration": "30-60 seconds", "aspect_ratio": "9:16"}'
        />
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
          className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
          placeholder="Perpetual usage rights across all Boulders social channels"
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

      {error && <p className="text-error text-sm">{error}</p>}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors"
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Brief"}
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
