"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { BriefCard } from "@/components/brief-card";
import type { BriefWithClaims, BriefCategory, BriefFormat } from "@/types/database";

const categories: { value: BriefCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "entertaining", label: "Entertaining" },
  { value: "ad", label: "Ad" },
  { value: "guide", label: "Guide" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
];

const formats: { value: BriefFormat | "all"; label: string }[] = [
  { value: "all", label: "All Formats" },
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "long_form", label: "Long Form" },
  { value: "photo", label: "Photo" },
];

const priceRanges = [
  { value: "all", label: "Any Price" },
  { value: "0-2000", label: "Under 2,000 DKK" },
  { value: "2000-3000", label: "2,000 - 3,000 DKK" },
  { value: "3000+", label: "Over 3,000 DKK" },
];

function labelFor<T extends { value: string; label: string }>(
  options: T[],
  value: string
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

interface BriefsClientProps {
  briefs: BriefWithClaims[];
  initialCategory?: BriefCategory;
  initialFormat?: BriefFormat;
}

export function BriefsClient({ briefs, initialCategory, initialFormat }: BriefsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryFilter = initialCategory || "all";
  const formatFilter = initialFormat || "all";

  const [priceFilter, setPriceFilter] = useState("all");
  const [gymFilter, setGymFilter] = useState("");

  const gyms = useMemo(() => {
    const uniqueGyms = new Set(briefs.map((b) => b.gym).filter(Boolean));
    return Array.from(uniqueGyms) as string[];
  }, [briefs]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/briefs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function clearAll() {
    setPriceFilter("all");
    setGymFilter("");
    router.push("/briefs");
  }

  const filteredBriefs = useMemo(() => {
    return briefs.filter((brief) => {
      if (gymFilter && brief.gym !== gymFilter) return false;

      if (priceFilter !== "all") {
        if (priceFilter === "0-2000" && brief.price_dkk >= 2000) return false;
        if (priceFilter === "2000-3000" && (brief.price_dkk < 2000 || brief.price_dkk > 3000)) return false;
        if (priceFilter === "3000+" && brief.price_dkk <= 3000) return false;
      }

      return true;
    });
  }, [briefs, priceFilter, gymFilter]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (categoryFilter !== "all") {
    activeFilters.push({
      key: "category",
      label: labelFor(categories, categoryFilter),
      clear: () => updateFilter("category", "all"),
    });
  }
  if (formatFilter !== "all") {
    activeFilters.push({
      key: "format",
      label: labelFor(formats, formatFilter),
      clear: () => updateFilter("format", "all"),
    });
  }
  if (priceFilter !== "all") {
    activeFilters.push({
      key: "price",
      label: labelFor(priceRanges, priceFilter),
      clear: () => setPriceFilter("all"),
    });
  }
  if (gymFilter) {
    activeFilters.push({
      key: "gym",
      label: gymFilter,
      clear: () => setGymFilter(""),
    });
  }

  const hasActiveFilters = activeFilters.length > 0;
  const totalCount = briefs.length;
  const shownCount = filteredBriefs.length;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Available Briefs</h1>
            <p className="text-muted">
              Browse open briefs and claim one to get started
            </p>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <select
              value={categoryFilter}
              onChange={(e) => updateFilter("category", e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={formatFilter}
              onChange={(e) => updateFilter("format", e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            >
              {formats.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </select>

            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            >
              {priceRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>

            <select
              value={gymFilter}
              onChange={(e) => setGymFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="">All Gyms</option>
              {gyms.map((gym) => (
                <option key={gym} value={gym}>
                  {gym}
                </option>
              ))}
            </select>
          </div>

          {/* Result summary + active filter chips */}
          <div className="flex flex-wrap items-center gap-2 mb-6 min-h-8">
            <p className="text-sm text-muted font-mono">
              {hasActiveFilters
                ? `${shownCount} of ${totalCount} briefs`
                : `${totalCount} brief${totalCount !== 1 ? "s" : ""}`}
            </p>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full hover:bg-accent hover:text-background transition-colors"
              >
                {f.label}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ))}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted hover:text-foreground underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Brief Grid */}
          {filteredBriefs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger-in">
              {filteredBriefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-surface border border-border rounded-xl">
              {totalCount === 0 ? (
                <p className="text-muted">
                  No briefs are open right now. Check back soon.
                </p>
              ) : (
                <>
                  <p className="text-muted mb-4">
                    No briefs match your filters
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex px-4 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
