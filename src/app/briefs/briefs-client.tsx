"use client";

import { useState, useMemo } from "react";
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

interface BriefsClientProps {
  briefs: BriefWithClaims[];
}

export function BriefsClient({ briefs }: BriefsClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<BriefCategory | "all">("all");
  const [formatFilter, setFormatFilter] = useState<BriefFormat | "all">("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [gymFilter, setGymFilter] = useState("");

  const gyms = useMemo(() => {
    const uniqueGyms = new Set(briefs.map((b) => b.gym).filter(Boolean));
    return Array.from(uniqueGyms) as string[];
  }, [briefs]);

  const filteredBriefs = useMemo(() => {
    return briefs.filter((brief) => {
      if (categoryFilter !== "all" && brief.category !== categoryFilter) return false;
      if (formatFilter !== "all" && brief.format !== formatFilter) return false;
      if (gymFilter && brief.gym !== gymFilter) return false;

      if (priceFilter !== "all") {
        if (priceFilter === "0-2000" && brief.price_dkk >= 2000) return false;
        if (priceFilter === "2000-3000" && (brief.price_dkk < 2000 || brief.price_dkk > 3000)) return false;
        if (priceFilter === "3000+" && brief.price_dkk <= 3000) return false;
      }

      return true;
    });
  }, [briefs, categoryFilter, formatFilter, priceFilter, gymFilter]);

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as BriefCategory | "all")}
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
              onChange={(e) => setFormatFilter(e.target.value as BriefFormat | "all")}
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

          {/* Brief Grid */}
          {filteredBriefs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger-in">
              {filteredBriefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted">No briefs match your filters</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
