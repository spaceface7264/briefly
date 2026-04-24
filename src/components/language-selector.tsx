"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, localeLabels, type Locale } from "@/lib/i18n/config";
import { useLocale, useTranslate } from "@/lib/i18n/provider";

export function LanguageSelector() {
  const current = useLocale();
  const t = useTranslate();
  const [pending, startTransition] = useTransition();

  function handleChange(locale: Locale) {
    if (locale === current || pending) return;
    startTransition(async () => {
      await setLocale(locale);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        {LOCALES.map((loc) => {
          const isSelected = current === loc;
          return (
            <button
              key={loc}
              type="button"
              disabled={pending}
              onClick={() => handleChange(loc)}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                isSelected
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border hover:border-border-strong hover:bg-surface-hover"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              aria-pressed={isSelected}
            >
              {localeLabels[loc]}
            </button>
          );
        })}
      </div>
      {pending && (
        <p className="text-xs text-muted">{t("common.saving")}</p>
      )}
    </div>
  );
}
