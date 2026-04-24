import { en, type Dictionary } from "./dictionaries/en";
import { da } from "./dictionaries/da";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { en, da };

type PathImpl<T, K extends keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${PathImpl<T[K], keyof T[K]>}` | K
    : K
  : never;

export type TranslationKey = PathImpl<Dictionary, keyof Dictionary>;

export type TranslateParams = Record<string, string | number>;

function resolvePath(dict: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let value: unknown = dict;
  for (const part of parts) {
    if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof value === "string" ? value : undefined;
}

function interpolate(value: string, params?: TranslateParams): string {
  if (!params) return value;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    value
  );
}

export type TranslateFn = (key: string, params?: TranslateParams) => string;

export function createTranslator(locale: Locale): TranslateFn {
  const dict = dictionaries[locale] ?? en;
  return function t(key, params) {
    const value = resolvePath(dict, key) ?? resolvePath(en, key);
    if (!value) return key;
    return interpolate(value, params);
  };
}

export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  return createTranslator(locale)(key, params);
}
