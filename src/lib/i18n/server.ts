import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isValidLocale,
  type Locale,
} from "./config";
import { createTranslator, type TranslateFn } from "./translate";

export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isValidLocale(cookieLocale)) return cookieLocale;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      const pref = (data as { preferred_language?: string | null } | null)
        ?.preferred_language;
      if (isValidLocale(pref)) return pref;
    }
  } catch {
    // ignore — fall through to default
  }

  return DEFAULT_LOCALE;
});

export const hasLocalePreference = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  if (cookieStore.has(LOCALE_COOKIE)) return true;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();
    const pref = (data as { preferred_language?: string | null } | null)
      ?.preferred_language;
    return isValidLocale(pref);
  } catch {
    return false;
  }
});

export async function getT(): Promise<TranslateFn> {
  const locale = await getLocale();
  return createTranslator(locale);
}
