"use client";

import { useMemo, useState } from "react";
import {
  LANGUAGES,
  LANGUAGES_MAX,
  languageLabel,
} from "@/lib/creator-profile";

interface LanguagePickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  /** Max selections. Defaults to LANGUAGES_MAX (the DB cap). */
  max?: number;
  /** Inline-input class so the picker matches surrounding form fields. */
  inputClassName?: string;
}

/**
 * Searchable multi-select for languages. Renders the selected
 * languages as removable chips above a search input; matches stream
 * below as a scrollable option list. Avoids the wall-of-chips problem
 * that a flat ChipPicker has with a 180-entry library.
 *
 * Matches both the English label and the ISO code (so a user can
 * type "en" or "english"). Substring match is case-insensitive.
 */
export function LanguagePicker({
  selected,
  onChange,
  max = LANGUAGES_MAX,
  inputClassName,
}: LanguagePickerProps) {
  const [query, setQuery] = useState("");
  const atCap = selected.length >= max;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Hide already-selected entries so the option list is a clean
    // "available to add" view; selected chips above are the
    // single source of truth for the current state.
    const available = LANGUAGES.filter((l) => !selected.includes(l.code));
    if (!q) return available;
    return available.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.code.toLowerCase().startsWith(q)
    );
  }, [query, selected]);

  function add(code: string) {
    if (atCap) return;
    onChange([...selected, code]);
    setQuery("");
  }

  function remove(code: string) {
    onChange(selected.filter((c) => c !== code));
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => remove(code)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-brand-muted text-brand border border-brand/40 hover:border-brand transition-colors"
              aria-label={`Remove ${languageLabel(code)}`}
            >
              {languageLabel(code)}
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={atCap ? `Limit ${max} reached` : "Search languages…"}
        disabled={atCap}
        className={
          inputClassName ??
          "w-full px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent transition-colors outline-none disabled:opacity-50"
        }
        aria-label="Search languages"
      />

      {!atCap && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul role="listbox" className="py-1">
              {filtered.map((lang) => (
                <li key={lang.code}>
                  <button
                    type="button"
                    onClick={() => add(lang.code)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors flex items-center justify-between gap-3"
                  >
                    <span>{lang.label}</span>
                    <span className="text-xs text-muted font-mono uppercase">
                      {lang.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
