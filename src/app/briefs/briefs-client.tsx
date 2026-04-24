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
import { useTranslate } from "@/lib/i18n/provider";
import type { BriefWithClaims, BriefCategory, BriefDurationClass } from "@/types/database";

const BRIEFS_PER_PAGE = 9;

interface BriefsClientProps {
  briefs: BriefWithClaims[];
  initialCategory?: BriefCategory;
  initialDurationClass?: BriefDurationClass;
}

export function BriefsClient({ briefs, initialCategory, initialDurationClass }: BriefsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslate();
  const hasMountedRef = useRef(false);

  const categories: { value: BriefCategory | "all"; label: string }[] = [
    { value: "all", label: t("briefs.filters.all") },
    { value: "entertaining", label: t("categories.entertaining") },
    { value: "ad", label: t("categories.ad") },
    { value: "guide", label: t("categories.guide") },
    { value: "event", label: t("categories.event") },
    { value: "community", label: t("categories.community") },
  ];

  const durations: { value: BriefDurationClass | "all"; label: string }[] = [
    { value: "all", label: t("briefs.filters.all") },
    { value: "short", label: t("durations.short") },
    { value: "medium", label: t("durations.medium") },
    { value: "long", label: t("durations.long") },
    { value: "static", label: t("durations.static") },
  ];

  const priceRanges = [
    { value: "all", label: t("briefs.filters.priceAny") },
    { value: "0-2000", label: t("briefs.filters.priceLow2k") },
    { value: "2000-3000", label: t("briefs.filters.priceMid") },
    { value: "3000+", label: t("briefs.filters.priceHigh3k") },
  ];

  const categoryFilter = initialCategory || "all";
  const durationFilter = initialDurationClass || "all";

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
    params.delete("page");
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
    durationFilter !== "all" ||
    priceFilter !== "all" ||
    gymFilter !== "";
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
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{t("briefs.pageTitle")}</h1>
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
                  {t("briefs.clear")}
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

              {/* Gym select — only if multiple gyms */}
              {gyms.length > 1 && (
                <>
                  <span className="hidden sm:block w-px h-4 bg-border" />
                  <select
                    value={gymFilter}
                    onChange={(e) => setGymFilter(e.target.value)}
                    className="no-global-focus-ring px-2.5 py-1 bg-transparent border border-border rounded-md text-xs text-muted hover:text-foreground hover:border-border-strong focus-visible:outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    <option value="">{t("briefs.gym")}</option>
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
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-stagger-in">
                {paginatedBriefs.map((brief) => (
                  <BriefCard key={brief.id} brief={brief} />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination className="mt-6 flex-col items-center gap-2">
                  <p className="value-text text-xs text-muted">
                    {t("briefs.pagination", { start: showingStart, end: showingEnd, total: shownCount })}
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
                  <p className="font-medium text-sm mb-1">{t("briefs.noOpen")}</p>
                  <p className="text-muted text-xs">{t("briefs.noOpenHint")}</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm mb-1">{t("briefs.noMatches")}</p>
                  <p className="text-muted text-xs mb-4">
                    {t("briefs.noMatchesHint")}
                  </p>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex px-3 py-1.5 border border-border-strong hover:bg-surface-hover text-xs font-medium rounded-md transition-colors"
                  >
                    {t("briefs.clearFilters")}
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
