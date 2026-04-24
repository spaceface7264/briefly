export const LOCALES = ["en", "da"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isValidLocale(value: unknown): value is Locale {
  return value === "en" || value === "da";
}

export const localeLabels: Record<Locale, string> = {
  en: "English",
  da: "Dansk",
};
