"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isValidLocale, type Locale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(
  locale: Locale
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidLocale(locale)) {
    return { ok: false, error: "Invalid locale" };
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("profiles") as any)
        .update({ preferred_language: locale })
        .eq("id", user.id);
    }
  } catch {
    // persistence best-effort; cookie is authoritative for this request
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
