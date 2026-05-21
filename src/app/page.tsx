import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountType, landingPathForAccountType } from "@/lib/account";

/**
 * The canonical home URL. Logged-in users go straight to their shell;
 * everyone else is sent to the creator-facing pitch at /for-creators
 * (with /for-brands as the org-facing sibling). Keeping the redirect
 * in a server component means search engines see the proper 307 hop
 * and bookmarks of `briefly.dk/` still land on a real page.
 */
export default async function Home() {
  let accountType: Awaited<ReturnType<typeof getAccountType>> | null = null;
  try {
    const supabase = await createClient();
    accountType = await getAccountType(supabase);
  } catch {
    // Supabase unavailable; treat as logged-out.
  }

  if (accountType) {
    redirect(landingPathForAccountType(accountType));
  }

  redirect("/for-creators");
}
