"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { BriefCard } from "@/components/brief-card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { BriefWithClaims, BriefCategory, BriefDurationClass } from "@/types/database";

const categories: { value: BriefCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "entertaining", label: "Entertaining" },
  { value: "ad", label: "Ad" },
  { value: "guide", label: "Guide" },
  { value: "event", label: "Event" },
  { value: "community", label: "Community" },
];

const durations: { value: BriefDurationClass | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "static", label: "Static" },
];

const priceRanges = [
  { value: "all", label: "Any" },
  { value: "0-2000", label: "<2k" },
  { value: "2000-3000", label: "2-3k" },
  { value: "3000+", label: "3k+" },
];

const BRIEFS_PER_PAGE = 9;

interface BriefsClientProps {
  briefs: BriefWithClaims[];
  initialCategory?: BriefCategory;
  initialDurationClass?: BriefDurationClass;
  /** Identity of the active org these briefs belong to. Rendered as a
   *  "Briefs by <logo> <name>" attribution next to the page title so
   *  creators in multiple orgs can tell at a glance which feed they're
   *  looking at without opening the org switcher. Null when the org
   *  row went missing (extremely rare, but the layout still makes
   *  sense without it). */
  org: { name: string; logoUrl: string | null; accentColor: string | null } | null;
}

export function BriefsClient({
  briefs,
  initialCategory,
  initialDurationClass,
  org,
}: BriefsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMountedRef = useRef(false);

  const categoryFilter = initialCategory || "all";
  const durationFilter = initialDurationClass || "all";

  const [priceFilter, setPriceFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");

  const locations = useMemo(() => {
    const uniqueLocations = new Set(briefs.map((b) => b.location).filter(Boolean));
    return Array.from(uniqueLocations) as string[];
  }, [briefs]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/briefs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function clearAll() {
    setPriceFilter("all");
    setLocationFilter("");
    router.push("/briefs");
  }

  const filteredBriefs = useMemo(() => {
    return briefs.filter((brief) => {
      if (locationFilter && brief.location !== locationFilter) return false;

      if (priceFilter !== "all") {
        if (priceFilter === "0-2000" && brief.price_dkk >= 2000) return false;
        if (priceFilter === "2000-3000" && (brief.price_dkk < 2000 || brief.price_dkk > 3000)) return false;
        if (priceFilter === "3000+" && brief.price_dkk <= 3000) return false;
      }

      return true;
    });
  }, [briefs, priceFilter, locationFilter]);

  const hasActiveFilters =
    categoryFilter !== "all" ||
    durationFilter !== "all" ||
    priceFilter !== "all" ||
    locationFilter !== "";
  const totalCount = briefs.length;
  const shownCount = filteredBriefs.length;
  const totalPages = Math.max(1, Math.ceil(shownCount / BRIEFS_PER_PAGE));
  const rawPage = Number(searchParams.get("page") || "1");
  const currentPage = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), totalPages) : 1;
  const pageStart = (currentPage - 1) * BRIEFS_PER_PAGE;
  const paginatedBriefs = filteredBriefs.slice(pageStart, pageStart + BRIEFS_PER_PAGE);
  const showingStart = shownCount === 0 ? 0 : pageStart + 1;
  const showingEnd = shownCount === 0 ? 0 : pageStart + paginatedBriefs.length;

  function buildPageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    return `/briefs${params.toString() ? `?${params.toString()}` : ""}`;
  }

  const pageItems = useMemo(() => {
    if (totalPages <= 1) return [];
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const items: Array<number | "ellipsis"> = [1];
    const windowStart = Math.max(2, currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, currentPage + 1);

    if (windowStart > 2) items.push("ellipsis");
    for (let page = windowStart; page <= windowEnd; page += 1) {
      items.push(page);
    }
    if (windowEnd < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);

    return items;
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPage]);

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          {/* Header row — title + count + filters inline */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Briefs</h1>
                {org && (
                  <span className="inline-flex items-center gap-2 text-base text-muted">
                    <span>by</span>
                    <OrgChip org={org} />
                  </span>
                )}
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

              {/* Duration pills */}
              <FilterGroup
                options={durations}
                value={durationFilter}
                onChange={(v) => updateFilter("duration", v)}
              />

              <span className="hidden sm:block w-px h-4 bg-border" />

              {/* Price pills */}
              <FilterGroup
                options={priceRanges}
                value={priceFilter}
                onChange={(v) => setPriceFilter(v)}
              />

              {/* Location select — only if multiple locations */}
              {locations.length > 1 && (
                <>
                  <span className="hidden sm:block w-px h-4 bg-border" />
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="no-global-focus-ring px-2.5 py-1 bg-transparent border border-border rounded-md text-xs text-muted hover:text-foreground hover:border-border-strong focus-visible:outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    <option value="">Location</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Brief Grid */}
          {filteredBriefs.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-stagger-in">
                {paginatedBriefs.map((brief) => (
                  <BriefCard key={brief.id} brief={brief} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination className="mt-6 flex-col items-center gap-2">
                  <p className="value-text text-xs text-muted">
                    Showing {showingStart}-{showingEnd} of {shownCount}
                  </p>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={buildPageHref(Math.max(1, currentPage - 1))}
                        text=""
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>

                    {pageItems.map((item, index) => (
                      <PaginationItem key={`${item}-${index}`}>
                        {item === "ellipsis" ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink href={buildPageHref(item)} isActive={item === currentPage}>
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href={buildPageHref(Math.min(totalPages, currentPage + 1))}
                        text=""
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
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

/**
 * Small inline org identity rendered next to the page title as
 * "Briefs by <chip>". Logo is loaded with a plain <img> rather than
 * next/image because org logos live on user-upload Supabase Storage
 * URLs we don't pre-register in next.config.ts (same rationale as
 * the admin sidebar's OrgIdentity). Falls back to an accent-tinted
 * initial tile when no logo has been uploaded.
 */
function OrgChip({
  org,
}: {
  org: { name: string; logoUrl: string | null; accentColor: string | null };
}) {
  const initial = org.name.charAt(0).toUpperCase();
  const accent = org.accentColor || "var(--color-accent)";

  return (
    <span className="inline-flex items-center gap-1.5 text-foreground">
      {org.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.logoUrl}
          alt=""
          className="size-5 shrink-0 rounded-sm border border-border bg-background object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-background"
          style={{ backgroundColor: accent }}
        >
          {initial}
        </span>
      )}
      <span className="font-semibold">{org.name}</span>
    </span>
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
