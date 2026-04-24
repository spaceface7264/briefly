"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { createTranslator, type TranslateFn } from "./translate";

interface LocaleContextValue {
  locale: Locale;
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(locale) }),
    [locale]
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useTranslate(): TranslateFn {
  return useContext(LocaleContext).t;
}
