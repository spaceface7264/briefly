"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { BriefCard } from "@/components/brief-card";
import type { BriefWithClaims, BriefCategory, BriefFormat } from "@/types/database";

const categories: { value: BriefCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "entertaining", label: "Entertaining" },
  { value: "ad", label: "Ad" },
  { value: "guide", label: "Guide" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
];

const formats: { value: BriefFormat | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_short", label: "YT Short" },
  { value: "long_form", label: "Long Form" },
  { value: "photo", label: "Photo" },
];

const priceRanges = [
  { value: "all", label: "Any" },
  { value: "0-2000", label: "<2k" },
  { value: "2000-3000", label: "2-3k" },
  { value: "3000+", label: "3k+" },
];

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

  const hasActiveFilters =
    categoryFilter !== "all" ||
    formatFilter !== "all" ||
    priceFilter !== "all" ||
    gymFilter !== "";
  const totalCount = briefs.length;
  const shownCount = filteredBriefs.length;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          {/* Header row — title + count + filters inline */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Briefs</h1>
                <span className="value-text text-sm text-muted">
                  {hasActiveFilters ? `${shownCount}/${totalCount}` : totalCount}
                </span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter bar — compact pill-style toggles */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Category pills */}
              <FilterGroup
                options={categories}
                value={categoryFilter}
                onChange={(v) => updateFilter("category", v)}
              />

              <span className="hidden sm:block w-px h-4 bg-border" />

              {/* Format pills */}
              <FilterGroup
                options={formats}
                value={formatFilter}
                onChange={(v) => updateFilter("format", v)}
              />

              <span className="hidden sm:block w-px h-4 bg-border" />

              {/* Price pills */}
              <FilterGroup
                options={priceRanges}
                value={priceFilter}
                onChange={(v) => setPriceFilter(v)}
              />

              {/* Gym select — only if multiple gyms */}
              {gyms.length > 1 && (
                <>
                  <span className="hidden sm:block w-px h-4 bg-border" />
                  <select
                    value={gymFilter}
                    onChange={(e) => setGymFilter(e.target.value)}
                    className="no-global-focus-ring px-2.5 py-1 bg-transparent border border-border rounded-md text-xs text-muted hover:text-foreground hover:border-border-strong focus-visible:outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    <option value="">Gym</option>
                    {gyms.map((gym) => (
                      <option key={gym} value={gym}>
                        {gym}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Brief Grid */}
          {filteredBriefs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-stagger-in">
              {filteredBriefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-border rounded-lg">
              {totalCount === 0 ? (
                <>
                  <p className="font-medium text-sm mb-1">No open briefs</p>
                  <p className="text-muted text-xs">Check back soon.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm mb-1">No matches</p>
                  <p className="text-muted text-xs mb-4">
                    Try removing a filter.
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex px-3 py-1.5 border border-border-strong hover:bg-surface-hover text-xs font-medium rounded-md transition-colors"
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

function FilterGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "px-2 py-1 text-xs rounded-md transition-all duration-100",
            value === opt.value
              ? "bg-surface-raised text-foreground font-medium border border-border-strong"
              : "text-muted hover:text-text-secondary border border-transparent",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
